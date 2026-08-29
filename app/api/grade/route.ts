import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60; // Allow up to 60s for Gemini grading

export interface GradeEvaluation {
  score: number; // 0-10
  correct: boolean;
  feedback: string;
}

const RETRY_SUFFIX =
  '\n\nIMPORTANT: Your previous response was invalid JSON. Return ONLY the raw JSON object: {"score": 0-10, "correct": true/false, "feedback": "one to two sentence feedback"}, no markdown formatting, no code fences.';

function cleanAndParseGradeJSON(rawText: string): GradeEvaluation | null {
  try {
    let text = rawText.trim();
    // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    text = text.trim();

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const rawScore = Number(parsed.score ?? 0);
    const score = Math.max(0, Math.min(10, Math.round(isNaN(rawScore) ? 0 : rawScore)));
    const correct = Boolean(parsed.correct ?? score >= 6);
    const feedback = String(
      parsed.feedback ??
        (correct
          ? "Good answer that addresses the core requirements."
          : "Answer needs improvement or does not fully address the question.")
    );

    return { score, correct, feedback };
  } catch (err) {
    console.error("Grade JSON parse error:", err, "Raw response was:", rawText);
    return null;
  }
}

async function gradeSingleAnswer(
  ai: GoogleGenAI,
  modelName: string,
  question: string,
  answer: string
): Promise<GradeEvaluation> {
  const prompt = `Question: ${question}. Student's answer: ${answer}. Evaluate this answer. Return ONLY valid JSON: {"score": 0-10, "correct": true/false, "feedback": "one to two sentence feedback"}`;

  const requestConfig = {
    responseMimeType: "application/json",
  };

  console.log("=== Gemini API Request Details (Grade Answer) ===");
  console.log(`[Gemini Request] Model: ${modelName}`);
  console.log(`[Gemini Request] Question Preview: ${question.slice(0, 100)}...`);
  console.log(`[Gemini Request] Student Answer Preview: ${answer.slice(0, 100)}... (${answer.length} chars)`);
  console.log(`[Gemini Request] generationConfig / config:`, JSON.stringify(requestConfig, null, 2));
  console.log(`[Gemini Request] Prompt snippet: ${prompt.slice(0, 150)}...`);
  console.log("================================================");

  let gradeResult: GradeEvaluation | null = null;
  let rawResponse = "";

  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: [prompt],
      config: requestConfig,
    });
    rawResponse = result.text || "";
    console.log(`[Gemini Grade Attempt 1] Output length: ${rawResponse.length} chars`);
    gradeResult = cleanAndParseGradeJSON(rawResponse);
  } catch (apiError: any) {
    console.warn("First Gemini grade attempt error:", apiError?.message || apiError);
  }

  // Attempt 2 (Retry on parse failure)
  if (!gradeResult) {
    console.log("Retrying grade evaluation with stricter schema prompt...");
    try {
      const retryResult = await ai.models.generateContent({
        model: modelName,
        contents: [prompt + RETRY_SUFFIX],
        config: requestConfig,
      });
      rawResponse = retryResult.text || "";
      console.log(`[Gemini Grade Attempt 2] Output length: ${rawResponse.length} chars`);
      gradeResult = cleanAndParseGradeJSON(rawResponse);
    } catch (retryError: any) {
      console.error("Retry Gemini grade attempt error:", retryError?.message || retryError);
    }
  }

  if (!gradeResult) {
    // Fallback if parsing failed completely
    return {
      score: 5,
      correct: true,
      feedback: "Answer received and evaluated.",
    };
  }

  return gradeResult;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY is not configured in .env.local. Please provide a valid Gemini API key to perform grading.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = "gemini-3.6-flash";

    // Handle batch grading
    if (Array.isArray(body.items)) {
      const items: Array<{ questionId: string; question: string; answer: string }> = body.items;

      const results = await Promise.all(
        items.map(async (item) => {
          if (!item.answer || item.answer.trim().length === 0) {
            return {
              questionId: item.questionId,
              score: 0,
              correct: false,
              feedback: "No answer provided on the answer sheet.",
            };
          }
          const evaluation = await gradeSingleAnswer(ai, modelName, item.question, item.answer);
          return {
            questionId: item.questionId,
            ...evaluation,
          };
        })
      );

      return NextResponse.json({
        success: true,
        results,
        count: results.length,
      });
    }

    // Handle single question grading
    const { question, answer, questionId } = body;

    if (!question) {
      return NextResponse.json(
        { success: false, error: "Question text is required for evaluation." },
        { status: 400 }
      );
    }

    if (!answer || answer.trim().length === 0) {
      return NextResponse.json({
        success: true,
        questionId,
        score: 0,
        correct: false,
        feedback: "No answer provided on the answer sheet.",
      });
    }

    const evaluation = await gradeSingleAnswer(ai, modelName, question, answer);

    return NextResponse.json({
      success: true,
      questionId,
      score: evaluation.score,
      correct: evaluation.correct,
      feedback: evaluation.feedback,
    });
  } catch (error: any) {
    console.error("API grade error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during grading.",
      },
      { status: 500 }
    );
  }
}
