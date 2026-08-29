import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  generateContentWithFallback,
  parseGeminiError,
} from "@/lib/gemini";

export const maxDuration = 60; // Allow up to 60s for Gemini processing

const EXACT_PROMPT =
  'Extract every question from this question paper in the exact printed order. Treat labelled sub-parts (e.g. 11(a), 11(b)) as separate question entries, each with their own id. Preserve the original question numbering exactly as printed. Return ONLY valid JSON, no markdown, no explanation, in this exact schema: [{"id": "11a", "number": "11", "subpart": "a", "text": "question text here", "page": 1}]';

const RETRY_SUFFIX =
  '\n\nIMPORTANT: Your previous output was invalid JSON. You must return ONLY the raw JSON array starting with [ and ending with ], no markdown formatting, no backticks, no notes.';

interface Question {
  id: string;
  number: string;
  subpart: string;
  text: string;
  page: number;
}

function cleanAndParseJSON(rawText: string): Question[] | null {
  try {
    let text = rawText.trim();
    // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    text = text.trim();

    // Sometimes the model may output text before the first [ or after the last ]
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      text = text.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return null;
    }

    // Validate array elements structure
    const validated: Question[] = parsed.map((item: any, idx: number) => ({
      id: String(item.id ?? `q_${idx + 1}`),
      number: String(item.number ?? `${idx + 1}`),
      subpart: String(item.subpart ?? ""),
      text: String(item.text ?? ""),
      page: Number(item.page ?? 1),
    }));

    return validated;
  } catch (err) {
    console.error("JSON parse error:", err, "Raw response was:", rawText);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No question paper file provided" },
        { status: 400 }
      );
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
    const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    const ai = new GoogleGenAI({ apiKey });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const requestConfig = {
      responseMimeType: "application/json",
    };

    console.log("=== Gemini API Request Details ===");
    console.log(`[Gemini Request] File Name: ${file.name}`);
    console.log(`[Gemini Request] File Size (FormData): ${file.size} bytes (${(file.size / 1024).toFixed(2)} KB)`);
    console.log(`[Gemini Request] Buffer Length: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(2)} KB)`);
    console.log(`[Gemini Request] Detected mimeType: ${mimeType}`);
    console.log(`[Gemini Request] Base64 payload length: ${base64Data.length} chars (${(base64Data.length / 1024).toFixed(2)} KB)`);
    console.log(`[Gemini Request] generationConfig / config:`, JSON.stringify(requestConfig, null, 2));
    console.log(`[Gemini Request] Prompt snippet: ${EXACT_PROMPT.slice(0, 120)}...`);
    console.log("==================================");

    if (buffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Uploaded file "${file.name}" is empty (0 bytes). Please select a valid question paper file.`,
        },
        { status: 400 }
      );
    }

    let questions: Question[] | null = null;
    let rawResponse = "";
    let modelUsed = "";
    let lastApiError: any = null;

    try {
      const genResult = await generateContentWithFallback(ai, {
        contents: [filePart, EXACT_PROMPT],
        config: requestConfig,
        label: "Extract Questions Attempt 1",
      });
      rawResponse = genResult.text;
      modelUsed = genResult.modelUsed;
      questions = cleanAndParseJSON(rawResponse);
    } catch (apiError: any) {
      lastApiError = apiError;
      console.warn("First Gemini attempt error:", apiError?.message || apiError);
    }

    // Attempt 2 (Retry with stricter prompt if parsing failed)
    if (!questions) {
      console.log("Retrying question extraction with stricter prompt reminder...");
      try {
        const retryResult = await generateContentWithFallback(ai, {
          contents: [filePart, EXACT_PROMPT + RETRY_SUFFIX],
          config: requestConfig,
          label: "Extract Questions Attempt 2",
        });
        rawResponse = retryResult.text;
        modelUsed = retryResult.modelUsed;
        questions = cleanAndParseJSON(rawResponse);
      } catch (retryError: any) {
        lastApiError = retryError;
        console.error("Retry Gemini attempt error:", retryError?.message || retryError);
      }
    }

    if (!questions || questions.length === 0) {
      if (lastApiError) {
        const parsed = parseGeminiError(lastApiError);
        if (parsed.isQuotaExceeded) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Gemini API Quota Exceeded (429): You have reached the free tier request limit for the selected model. Please wait a short moment or update GEMINI_MODEL in .env.local (e.g. gemini-2.5-flash).",
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
                "Gemini model is currently experiencing high demand (503). Please retry in a few seconds.",
              details: parsed.message,
            },
            { status: 503 }
          );
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to extract valid questions JSON from the question paper.",
          rawResponse: rawResponse.slice(0, 500),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
      fileName: file.name,
      modelUsed,
    });
  } catch (error: any) {
    console.error("API extract-questions error:", error);
    const parsed = parseGeminiError(error);
    if (parsed.isQuotaExceeded) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini API Quota Exceeded (429): You have reached the free tier limit. Please wait or set GEMINI_MODEL in .env.local.",
          details: parsed.message,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during extraction.",
      },
      { status: 500 }
    );
  }
}
