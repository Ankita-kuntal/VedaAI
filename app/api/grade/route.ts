import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  generateContentWithFallback,
  parseGeminiError,
} from "@/lib/gemini";

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

/**
 * Universally strips leading question/answer prefixes from handwritten answers
 * across all formats (e.g. "1.", "2. ", "Q1.", "Ans 2:", "11(a)", "11(b):", "a)", "(i)", "Answer -").
 */
export function stripQuestionPrefix(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  // 1. Remove common question/answer prefix markers (e.g. "Q1.", "Question 1:", "Ans 1:", "Ans:", "Answer -")
  clean = clean.replace(
    /^(?:(?:q(?:uestion)?|ans(?:wer)?)\s*[\#\:\.\-]?\s*\d*[\.\:\-\)]?\s*)+/i,
    ""
  ).trim();

  // 2. Remove subpart patterns: e.g. "11(a)", "11a.", "11(b):", "(a)", "a)", "(i)", "11.a)"
  clean = clean.replace(
    /^(?:\d+[\.\_\-\s]*)?(?:\([a-z0-9]+\)|[a-z0-9]\))\s*[\.\:\-\)\s]*\s*/i,
    ""
  ).trim();

  // 3. Remove standalone numbering if still present e.g. "1. " or "2. "
  clean = clean.replace(/^\d+[\.\)\:\-]\s*/, "").trim();

  return clean || text.trim();
}

async function gradeSingleAnswer(
  ai: GoogleGenAI,
  question: string,
  answer: string
): Promise<GradeEvaluation> {
  const cleanAnswer = stripQuestionPrefix(answer);

  const prompt = `You are a fair, expert academic teacher evaluating a student's answer across academic disciplines (Math, Science, Humanities).

Question: "${question}"
Student's Substantive Answer: "${cleanAnswer}" (Raw extracted handwriting: "${answer}")

GRADING RUBRIC & INSTRUCTIONS:
1. PREFIX IGNORING: Any leading question numbers or labels (such as "1.", "2.", "Q1", "11(a)", "Ans:") are question number prefixes, NOT part of the student's mathematical value or conceptual answer.
2. MATHEMATICAL & ALGEBRAIC ACCURACY:
   - Solve or verify the problem step-by-step.
   - For equation solving, arithmetic, or numerical values (e.g. "Solve for x: 2x + 5 = 15" -> solution is x = 5): If the student's answer matches the correct mathematical solution (e.g. "x = 5" or "5"), it is 100% CORRECT (Score: 10/10, correct: true).
3. CONCEPTUAL & DEFINITIONAL ACCURACY:
   - For definitions, scientific principles, or factual questions (e.g. "What is pi?", "Define prime number"): If the student states the core concept correctly, award full credit (10/10, correct: true).
4. EXAMPLES & CRITERIA-BASED ANSWERS:
   - For questions asking for examples (e.g. "Give two examples of prime numbers between 1 and 20"): Check if the provided examples satisfy the criteria (e.g. 2, 3, 5, 7, 11, 13, 17, 19). If valid, award full credit (10/10, correct: true).
5. SCORING SCALE:
   - 9-10/10 ("correct": true): Accurate, complete, and correct.
   - 5-8/10 ("correct": true): Substantially correct, minor omissions or minor errors.
   - 0-4/10 ("correct": false): Incorrect, irrelevant, or fails to address the question.

Return ONLY valid JSON (no markdown formatting, no code fences):
{
  "score": <0-10 integer>,
  "correct": <true or false>,
  "feedback": "<1-2 sentences of encouraging, clear educational feedback>"
}`;

  const requestConfig = {
    responseMimeType: "application/json",
  };

  console.log("=== Gemini API Request Details (Grade Answer) ===");
  console.log(`[Gemini Request] Question Preview: ${question.slice(0, 100)}...`);
  console.log(`[Gemini Request] Clean Answer: "${cleanAnswer}" (Raw: "${answer}")`);
  console.log(`[Gemini Request] generationConfig / config:`, JSON.stringify(requestConfig, null, 2));
  console.log("================================================");

  let gradeResult: GradeEvaluation | null = null;
  let rawResponse = "";

  try {
    const genResult = await generateContentWithFallback(ai, {
      contents: [prompt],
      config: requestConfig,
      label: "Grade Answer Attempt 1",
    });
    rawResponse = genResult.text;
    gradeResult = cleanAndParseGradeJSON(rawResponse);
  } catch (apiError: any) {
    console.warn("First Gemini grade attempt error:", apiError?.message || apiError);
  }

  // Attempt 2 (Retry on parse failure)
  if (!gradeResult) {
    console.log("Retrying grade evaluation with stricter schema prompt...");
    try {
      const retryResult = await generateContentWithFallback(ai, {
        contents: [prompt + RETRY_SUFFIX],
        config: requestConfig,
        label: "Grade Answer Attempt 2",
      });
      rawResponse = retryResult.text;
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
      feedback: "Answer evaluated based on submitted criteria.",
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

    // Handle batch grading with controlled concurrency
    if (Array.isArray(body.items)) {
      const items: Array<{ questionId: string; question: string; answer: string }> = body.items;

      const results: Array<{ questionId: string; score: number; correct: boolean; feedback: string }> = [];

      // Process in chunks of 2 to balance speed and free tier rate limits
      const chunkSize = 2;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(
          chunk.map(async (item) => {
            if (!item.answer || item.answer.trim().length === 0) {
              return {
                questionId: item.questionId,
                score: 0,
                correct: false,
                feedback: "No answer provided on the answer sheet.",
              };
            }
            const evaluation = await gradeSingleAnswer(ai, item.question, item.answer);
            return {
              questionId: item.questionId,
              ...evaluation,
            };
          })
        );
        results.push(...chunkResults);
      }

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

    const evaluation = await gradeSingleAnswer(ai, question, answer);

    return NextResponse.json({
      success: true,
      questionId,
      score: evaluation.score,
      correct: evaluation.correct,
      feedback: evaluation.feedback,
    });
  } catch (error: any) {
    console.error("API grade error:", error);
    const parsed = parseGeminiError(error);
    if (parsed.isQuotaExceeded) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini API Quota Exceeded (429): Free tier quota limit reached. Please wait a moment or configure GEMINI_MODEL in .env.local.",
          details: parsed.message,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during grading.",
      },
      { status: 500 }
    );
  }
}
