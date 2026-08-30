# VedaAI — AI Assessment & Answer Sheet Mapping

A Next.js application that automates question extraction, handwriting transcription, answer-to-question mapping, and grading from printed question papers and handwritten student answer sheets.

---

## Workflow Overview

1. **Upload**: Upload a printed Question Paper and a student's handwritten Answer Sheet (multi-page PDF or image). Files persist in browser IndexedDB across page reloads.
2. **Question Extraction (`/api/extract-questions`)**: Parses the question paper in printed order and splits compound sub-parts (e.g. `11(a)` and `11(b)`) into discrete items (`11a`, `11b`).
3. **Answer Mapping (`/api/extract-answers`)**: Transcribes handwritten answers, maps each answer to its question ID, flags unanswered questions, and returns normalized bounding box coordinates for each response.
4. **AI Grading (`/api/grade`)**: Evaluates each answered question (0–10 score, correctness flag, and 1–2 sentence pedagogical feedback).
5. **Interactive Review (`/review`)**: Displays questions and grades on the left, and the rendered PDF/image on the right. Selecting any question automatically scrolls to and highlights that answer with a green bounding box.

---

## Technical Details

### Direct Multimodal Pipeline (No OCR Step)
The application skips traditional OCR engines (like Tesseract or Textract). Raw PDF/image buffers are converted to base64 and passed directly to Gemini via `@google/genai`. 

This avoids the transcription errors common with handwriting OCR (such as dropped exponents, garbled math symbols, or misread labels like `11(a)`) and allows Gemini to resolve visual layout, handwriting transcription, and bounding box coordinates in a single request.

### Bounding Box Coordinate System
- **Normalized Coordinates**: Gemini outputs coordinates on a `0–1000` scale: `[ymin, xmin, ymax, xmax]`.
- **Responsive Percentage Positioning**: Coordinates convert directly to CSS percentages (`top: ymin / 10%`, `left: xmin / 10%`, `height: (ymax - ymin) / 10%`, `width: (xmax - xmin) / 10%`) relative to the rendered page canvas.
- **Neighbor Midpoint Clamping**: When subparts appear on consecutive lines (e.g. `11a` and `11b`), the overlay engine checks adjacent boxes on the same page and clamps padding to the midpoint between lines to prevent overlapping.
- **Single-Line Padding**: Single-line answers enforce a minimum visual height (`3.6%`) and horizontal breathing room (`1.6%`) so borders don't slice through text.
- **Auto-Centering**: Selecting a question calculates the vertical center of the bounding box and smoothly scrolls the viewport to position the answer at center.

### Handled Edge Cases
- **Out-of-Order Answers**: Answers written non-sequentially are matched by question markers and content rather than page position.
- **Multi-Page Answers**: Answers spanning multiple pages return a `regions` array; the UI provides page tabs (`Page 1`, `Page 2`) that switch pages and re-center on click.
- **Unanswered Questions**: Skipped questions are marked with an "Unanswered" badge and zero score without rendering empty highlight boxes.
- **Unmatched Handwriting**: Stray calculations or unassigned notes are placed in an "Unmatched Answers" drawer with clickable highlights.
- **Grading Prefix Stripping**: A regex pre-processor strips question prefixes (`"2. "`, `"Q1."`, `"Ans: "`) before grading so the model evaluates the actual solution instead of mistaking the question number for the answer.
- **Multi-Model Quota Fallback**: API calls go through a fallback cascade (`gemini-3.5-flash-lite` → `gemini-2.5-flash` → `gemini-3.7-flash`) on HTTP 429 / 503 errors, with prompt retries for malformed JSON. Batch grading runs in chunks of 2 to stay within rate limits.
- **IndexedDB Persistence**: Raw binary files (`File` / `Blob`) are saved in IndexedDB (`vedaai_storage`), while extracted JSON is saved in `sessionStorage`, keeping state intact across browser refreshes.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **AI SDK & Models**: `@google/genai` (Gemini 3.5 Flash Lite default, with multi-model fallback)
- **Document Rendering**: `react-pdf` (with local PDF.js worker) and native image canvas
- **Client Storage**: IndexedDB (binary files) + `sessionStorage` (metadata & extraction state)

---

## Setup & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: defaults to gemini-3.5-flash-lite
GEMINI_MODEL=gemini-3.5-flash-lite
```

### 3. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
