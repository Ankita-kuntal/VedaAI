import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  generateContentWithFallback,
  parseGeminiError,
} from "@/lib/gemini";

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
  '\n\nIMPORTANT: Your previous output was invalid JSON. Return ONLY the raw JSON object with keys "answers" and "unmatchedAnswers", no markdown formatting, no code fences.';

function normalizeBbox(raw: any): [number, number, number, number] {
  if (Array.isArray(raw) && raw.length >= 4) {
    const ymin = Math.max(0, Math.min(1000, Number(raw[0]) || 0));
    const xmin = Math.max(0, Math.min(1000, Number(raw[1]) || 0));
    const ymax = Math.max(0, Math.min(1000, Number(raw[2]) || 1000));
    const xmax = Math.max(0, Math.min(1000, Number(raw[3]) || 1000));
    return [ymin, xmin, ymax, xmax];
  }
  return [0, 0, 1000, 1000];
}

function cleanAndParseAnswersJSON(rawText: string): ParsedAnswersResult | null {
  try {
    let text = rawText.trim();
    // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    text = text.trim();

    // Check if the response is wrapped in an array or an object
    const firstBracket = text.indexOf("[");
    const firstBrace = text.indexOf("{");

    let isTopLevelArray = false;
    let startIdx = -1;
    let endIdx = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      isTopLevelArray = true;
      startIdx = firstBracket;
      endIdx = text.lastIndexOf("]");
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
      endIdx = text.lastIndexOf("}");
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      text = text.substring(startIdx, endIdx + 1);
    }

    const parsed = JSON.parse(text);

    let rawAnswers: any[] = [];
    let rawUnmatched: any[] = [];

    if (Array.isArray(parsed)) {
      rawAnswers = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed.answers)) {
        rawAnswers = parsed.answers;
      } else if (Array.isArray(parsed.matchedAnswers)) {
        rawAnswers = parsed.matchedAnswers;
      } else if (Array.isArray(parsed.questions)) {
        rawAnswers = parsed.questions;
      }

      if (Array.isArray(parsed.unmatchedAnswers)) {
        rawUnmatched = parsed.unmatchedAnswers;
      } else if (Array.isArray(parsed.unmatched)) {
        rawUnmatched = parsed.unmatched;
      }
    }

    const answers: MatchedAnswer[] = rawAnswers.map((item: any) => {
      const regionsRaw = Array.isArray(item.regions) ? item.regions : [];
      const regions: AnswerRegion[] = regionsRaw.map((r: any) => ({
        page: Number(r.page ?? 1),
        bbox: normalizeBbox(r.bbox),
      }));

      // If no regions provided, provide a default fallback region
      if (regions.length === 0 && item.answered !== false) {
        regions.push({
          page: Number(item.page ?? 1),
          bbox: item.bbox ? normalizeBbox(item.bbox) : [0, 0, 1000, 1000],
        });
      }

      return {
        questionId: String(item.questionId ?? item.id ?? ""),
        answered: item.answered !== false && Boolean(item.extractedText && item.extractedText.trim().length > 0),
        extractedText: String(item.extractedText ?? item.text ?? item.answer ?? ""),
        regions,
      };
    });

    const unmatchedAnswers: UnmatchedAnswer[] = rawUnmatched.map((item: any) => {
      const regionsRaw = Array.isArray(item.regions) ? item.regions : [];
      const regions: AnswerRegion[] = regionsRaw.map((r: any) => ({
        page: Number(r.page ?? 1),
        bbox: normalizeBbox(r.bbox),
      }));

      if (regions.length === 0) {
        regions.push({
          page: Number(item.page ?? 1),
          bbox: item.bbox ? normalizeBbox(item.bbox) : [0, 0, 1000, 1000],
        });
      }

      return {
        extractedText: String(item.extractedText ?? item.text ?? ""),
        regions,
      };
    });

    return { answers, unmatchedAnswers };
  } catch (err) {
    console.error(
      "Answers JSON parse error:",
      err,
      "Raw response was:",
      rawText
    );
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

    const prompt = `You are an expert AI assessment analyzer evaluating a student's handwritten answer sheet.
You are given the list of questions from the question paper:
${questionsJsonStr}

CRITICAL RULES:
1. OUT-OF-ORDER & NON-SEQUENTIAL MATCHING:
   - Students frequently write answers out of order (e.g. Question 2 before Question 1, or Question 11b before 11a).
   - Match each handwritten answer strictly to its corresponding question in the questions list using visible question labels (e.g. "Ans 1", "Q2", "11(a)", "11(b)", "3.", etc.) and the semantic meaning/content of the handwriting.
   - Do NOT assume answers appear in sequential top-to-bottom order.
   - Set "questionId" in the output to the EXACT "id" value from the provided questions list (e.g. "1", "2", "11a", "11b").

2. STRICT ISOLATION OF SUBPARTS & INDIVIDUAL LINES:
   - Each subpart (e.g., 11(a) vs 11(b)) is a COMPLETELY SEPARATE, DISTINCT QUESTION.
   - For subpart 11(a): Extract ONLY the line(s) answering 11(a). Its bounding box MUST NOT include or touch the 11(b) line.
   - For subpart 11(b): Extract ONLY the line(s) answering 11(b). Its "ymin" MUST start right at the top of the 11(b) text line, NOT at the 11(a) line. Its "ymax" MUST be the bottom of the 11(b) line. It MUST NOT include or bleed into the 11(a) line.
   - NEVER create a bounding box that covers multiple distinct questions or subparts together. Every question's bounding box MUST be independent.

3. BOUNDING BOX ACCURACY & PADDING (0-1000 Normalized Scale):
   - Return tight, clean bounding boxes as [ymin, xmin, ymax, xmax] in normalized 0-1000 coordinates where [0,0] is the top-left corner of the page and [1000,1000] is the bottom-right corner.
   - HORIZONTAL BOUNDS: "xmin" MUST start cleanly at the leftmost character of the handwriting (including the question/answer number prefix like "1." or "Ans 1:" or "11(b)"). Do NOT cut into words or start mid-word. "xmax" MUST encompass the rightmost character of the line.
   - VERTICAL BOUNDS: "ymin" is just above the highest ascender/capital letter of this specific answer's text, and "ymax" is just below the lowest descender of this specific answer's text.
   - For short/single-line answers (like "2. x = 5" or "11(b) Examples: 2 and 3"), ensure the bounding box has adequate vertical height (e.g. height of at least 35-50 normalized units / ~4-5% of page) so the full line is cleanly enclosed and not sliced through.

4. MULTI-PAGE & MULTI-BLOCK ANSWERS:
   - If an answer continues across multiple pages, return an array in "regions" with an object for each page: [{"page": 1, "bbox": [ymin, xmin, ymax, xmax]}, {"page": 2, "bbox": [ymin, xmin, ymax, xmax]}].
   - If an answer is on a single page, return an array with one region object: [{"page": 1, "bbox": [ymin, xmin, ymax, xmax]}].

5. UNANSWERED & UNMATCHED CONTENT:
   - If a question from the list is not answered anywhere on the sheet, return {"questionId": "<id>", "answered": false, "extractedText": "", "regions": []}.
   - If there is student handwriting that does not correspond to any known question in the list, place it in the "unmatchedAnswers" array.

Return ONLY valid JSON (no markdown fences, no extra text) with this exact schema:
{
  "answers": [
    {
      "questionId": "1",
      "answered": true,
      "extractedText": "full transcript of handwritten answer",
      "regions": [
        {
          "page": 1,
          "bbox": [ymin, xmin, ymax, xmax]
        }
      ]
    }
  ],
  "unmatchedAnswers": [
    {
      "extractedText": "unmatched handwriting transcript",
      "regions": [
        {
          "page": 1,
          "bbox": [ymin, xmin, ymax, xmax]
        }
      ]
    }
  ]
}`;

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
    console.log(`[Gemini Request] File Name: ${file.name}`);
    console.log(
      `[Gemini Request] File Size (FormData): ${file.size} bytes (${(
        file.size / 1024
      ).toFixed(2)} KB)`
    );

    if (buffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Uploaded answer sheet file "${file.name}" is empty (0 bytes).`,
        },
        { status: 400 }
      );
    }

    let parsedResult: ParsedAnswersResult | null = null;
    let rawResponse = "";
    let modelUsed = "";
    let lastApiError: any = null;

    try {
      const genResult = await generateContentWithFallback(ai, {
        contents: [filePart, prompt],
        config: requestConfig,
        label: "Extract Answers Attempt 1",
      });
      rawResponse = genResult.text;
      modelUsed = genResult.modelUsed;
      parsedResult = cleanAndParseAnswersJSON(rawResponse);
    } catch (apiError: any) {
      lastApiError = apiError;
      console.warn(
        "First Gemini answers extraction attempt error:",
        apiError?.message || apiError
      );
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
        const retryResult = await generateContentWithFallback(ai, {
          contents: [filePart, prompt + RETRY_SUFFIX],
          config: requestConfig,
          label: "Extract Answers Attempt 2",
        });
        rawResponse = retryResult.text;
        modelUsed = retryResult.modelUsed;
        parsedResult = cleanAndParseAnswersJSON(rawResponse);
      } catch (retryError: any) {
        lastApiError = retryError;
        console.error(
          "Retry Gemini answer extraction attempt error:",
          retryError?.message || retryError
        );
      }
    }

    if (!parsedResult) {
      if (lastApiError) {
        const parsed = parseGeminiError(lastApiError);
        if (parsed.isQuotaExceeded) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Gemini API Quota Exceeded (429): You have reached the free tier limit. Please wait a moment or update GEMINI_MODEL in .env.local.",
              details: parsed.message,
            },
            { status: 429 }
          );
        }
        if (parsed.isOverloaded) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Gemini model is currently experiencing high demand (503). Please retry shortly.",
              details: parsed.message,
            },
            { status: 503 }
          );
        }
      }

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

    console.log("=== Extracted Answers from Gemini ===");
    console.log(JSON.stringify(parsedResult, null, 2));

    return NextResponse.json({
      success: true,
      answers: parsedResult.answers,
      unmatchedAnswers: parsedResult.unmatchedAnswers,
      count: parsedResult.answers.length,
      unmatchedCount: parsedResult.unmatchedAnswers.length,
      fileName: file.name,
      modelUsed,
    });
  } catch (error: any) {
    console.error("API extract-answers error:", error);
    const parsed = parseGeminiError(error);
    if (parsed.isQuotaExceeded) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini API Quota Exceeded (429): Free tier limit reached. Please wait or set GEMINI_MODEL in .env.local.",
          details: parsed.message,
        },
        { status: 429 }
      );
    }

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
