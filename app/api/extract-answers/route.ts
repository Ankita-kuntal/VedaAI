import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60; // Allow up to 60s for Gemini processing

export interface AnswerRegion {
  page: number;
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000 scale
}

export interface MatchedAnswer {
  questionId: string;
  answered: boolean;
  extractedText: string;
  regions: AnswerRegion[];
}

export interface UnmatchedAnswer {
  extractedText: string;
  regions: AnswerRegion[];
}

interface ParsedAnswersResult {
  answers: MatchedAnswer[];
  unmatchedAnswers: UnmatchedAnswer[];
}

const RETRY_SUFFIX =
  '\n\nIMPORTANT: Your previous output was invalid JSON. You must return ONLY the raw JSON, no markdown formatting, no backticks, no explanations. Schema: [{"questionId": "11a", "answered": true, "extractedText": "...", "regions": [{"page": 1, "bbox": [ymin,xmin,ymax,xmax]}]}], plus a separate array "unmatchedAnswers": [{"extractedText": "...", "regions": [...]}]';

function cleanAndParseAnswersJSON(rawText: string): ParsedAnswersResult | null {
  try {
    let text = rawText.trim();
    // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    text = text.trim();

    // Look for JSON object or array
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");

    let parsed: any = null;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      // It might be an object { answers: [...], unmatchedAnswers: [...] } or { matchedAnswers: [...], ... }
      const lastBrace = text.lastIndexOf("}");
      if (lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonStr);
      }
    } else if (firstBracket !== -1) {
      // It might be an array [...] or array with additional content
      const lastBracket = text.lastIndexOf("]");
      if (lastBracket !== -1 && lastBracket > firstBracket) {
        const jsonStr = text.substring(firstBracket, lastBracket + 1);
        parsed = JSON.parse(jsonStr);
      }
    }

    if (!parsed) {
      parsed = JSON.parse(text);
    }

    let answersRaw: any[] = [];
    let unmatchedRaw: any[] = [];

    if (Array.isArray(parsed)) {
      answersRaw = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      answersRaw =
        parsed.answers ||
        parsed.matchedAnswers ||
        parsed.matched_answers ||
        parsed.questions ||
        [];
      unmatchedRaw =
        parsed.unmatchedAnswers ||
        parsed.unmatched_answers ||
        parsed.unmatched ||
        [];
    }

    const answers: MatchedAnswer[] = answersRaw.map((item: any, idx: number) => {
      const regionsRaw = Array.isArray(item.regions) ? item.regions : [];
      const regions: AnswerRegion[] = regionsRaw.map((r: any) => ({
        page: Number(r.page ?? 1),
        bbox:
          Array.isArray(r.bbox) && r.bbox.length === 4
            ? [
                Number(r.bbox[0]),
                Number(r.bbox[1]),
                Number(r.bbox[2]),
                Number(r.bbox[3]),
              ]
            : [0, 0, 1000, 1000],
      }));

      return {
        questionId: String(item.questionId ?? item.id ?? `q_${idx + 1}`),
        answered: Boolean(
          item.answered ??
            (item.extractedText && item.extractedText.trim().length > 0)
        ),
        extractedText: String(item.extractedText ?? item.text ?? ""),
        regions,
      };
    });

    const unmatchedAnswers: UnmatchedAnswer[] = (
      Array.isArray(unmatchedRaw) ? unmatchedRaw : []
    ).map((item: any) => {
      const regionsRaw = Array.isArray(item.regions) ? item.regions : [];
      const regions: AnswerRegion[] = regionsRaw.map((r: any) => ({
        page: Number(r.page ?? 1),
        bbox:
          Array.isArray(r.bbox) && r.bbox.length === 4
            ? [
                Number(r.bbox[0]),
                Number(r.bbox[1]),
                Number(r.bbox[2]),
                Number(r.bbox[3]),
              ]
            : [0, 0, 1000, 1000],
      }));

      return {
        extractedText: String(item.extractedText ?? item.text ?? ""),
        regions,
      };
    });

    return { answers, unmatchedAnswers };
  } catch (err) {
    console.error("Answers JSON parse error:", err, "Raw response was:", rawText);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const questionsRaw = formData.get("questions") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No answer sheet file provided" },
        { status: 400 }
      );
    }

    if (!questionsRaw) {
      return NextResponse.json(
        { success: false, error: "No question list provided for mapping" },
        { status: 400 }
      );
    }

    let questionsJsonStr = "";
    try {
      const parsedQ = JSON.parse(questionsRaw);
      questionsJsonStr = JSON.stringify(parsedQ);
    } catch {
      questionsJsonStr = questionsRaw;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY is not configured in .env.local. Please provide a valid Gemini API key to perform extraction.",
        },
        { status: 500 }
      );
    }

    // Convert file to base64 inline part
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType =
      file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    const ai = new GoogleGenAI({ apiKey });
    const modelName = "gemini-3.6-flash";

    const prompt = `You are given a list of questions: ${questionsJsonStr}. Analyze this handwritten student answer sheet. For each question, find the corresponding written answer, matching by visible question number/label first, then by content if no label is visible. For each matched answer, extract the answer text and return a tight bounding box around ONLY the handwritten answer region (not the whole page), using normalized coordinates on a 0-1000 scale as [ymin, xmin, ymax, xmax], and the page number it appears on. If an answer spans multiple pages, return multiple region objects. If a question has no matching answer anywhere, mark it unanswered. If any handwritten content doesn't match any known question, include it separately as an unmatched answer. Return ONLY valid JSON, no markdown, in this exact schema: [{"questionId": "11a", "answered": true, "extractedText": "...", "regions": [{"page": 1, "bbox": [ymin,xmin,ymax,xmax]}]}], plus a separate array "unmatchedAnswers": [{"extractedText": "...", "regions": [...]}]`;

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const requestConfig = {
      responseMimeType: "application/json",
    };

    console.log("=== Gemini API Request Details (Extract Answers) ===");
    console.log(`[Gemini Request] Model: ${modelName}`);
    console.log(`[Gemini Request] File Name: ${file.name}`);
    console.log(
      `[Gemini Request] File Size (FormData): ${file.size} bytes (${(
        file.size / 1024
      ).toFixed(2)} KB)`
    );
    console.log(
      `[Gemini Request] Buffer Length: ${buffer.length} bytes (${(
        buffer.length / 1024
      ).toFixed(2)} KB)`
    );
    console.log(`[Gemini Request] Detected mimeType: ${mimeType}`);
    console.log(
      `[Gemini Request] Base64 payload length: ${base64Data.length} chars (${(
        base64Data.length / 1024
      ).toFixed(2)} KB)`
    );
    console.log(
      `[Gemini Request] Questions Context Length: ${questionsJsonStr.length} chars`
    );
    console.log(
      `[Gemini Request] generationConfig / config:`,
      JSON.stringify(requestConfig, null, 2)
    );
    console.log(`[Gemini Request] Prompt snippet: ${prompt.slice(0, 160)}...`);
    console.log("====================================================");

    if (buffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Uploaded answer sheet file "${file.name}" is empty (0 bytes).`,
        },
        { status: 400 }
      );
    }

    // Attempt 1
    let parsedResult: ParsedAnswersResult | null = null;
    let rawResponse = "";

    try {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: [filePart, prompt],
        config: requestConfig,
      });
      rawResponse = result.text || "";
      console.log(
        `[Gemini Answer Extraction Attempt 1] Output length: ${rawResponse.length} chars`
      );
      parsedResult = cleanAndParseAnswersJSON(rawResponse);
    } catch (apiError: any) {
      console.warn(
        "First Gemini answers extraction attempt error:",
        apiError?.message || apiError
      );
      if (apiError?.status || apiError?.errorDetails) {
        console.warn(
          "Gemini Error Details:",
          JSON.stringify(
            { status: apiError?.status, details: apiError?.errorDetails },
            null,
            2
          )
        );
      }
    }

    // Attempt 2 (Retry with stricter prompt if parsing failed)
    if (
      !parsedResult ||
      (parsedResult.answers.length === 0 &&
        parsedResult.unmatchedAnswers.length === 0)
    ) {
      console.log(
        "Retrying answer extraction with stricter prompt reminder..."
      );
      try {
        const retryResult = await ai.models.generateContent({
          model: modelName,
          contents: [filePart, prompt + RETRY_SUFFIX],
          config: requestConfig,
        });
        rawResponse = retryResult.text || "";
        console.log(
          `[Gemini Answer Extraction Attempt 2] Output length: ${rawResponse.length} chars`
        );
        parsedResult = cleanAndParseAnswersJSON(rawResponse);
      } catch (retryError: any) {
        console.error(
          "Retry Gemini answer extraction attempt error:",
          retryError?.message || retryError
        );
      }
    }

    if (!parsedResult) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to extract and map valid answers JSON from the answer sheet.",
          rawResponse: rawResponse.slice(0, 500),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      answers: parsedResult.answers,
      unmatchedAnswers: parsedResult.unmatchedAnswers,
      count: parsedResult.answers.length,
      unmatchedCount: parsedResult.unmatchedAnswers.length,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error("API extract-answers error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "An unexpected error occurred during answer extraction.",
      },
      { status: 500 }
    );
  }
}
