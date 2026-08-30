# VedaAI — AI Assessment & Answer Sheet Mapping

An AI-powered tool for teachers that automates question extraction, handwriting transcription, answer mapping, and grading from test papers and student answer sheets.

---

## What It Does

1. **Upload Files**: Upload a printed Question Paper and a student's handwritten Answer Sheet (PDF or image).
2. **Question Extraction**: Extracts all questions in sequence, splitting compound sub-parts (like `11(a)` and `11(b)`) into separate trackable items.
3. **Handwriting Mapping & Bounding Boxes**: Reads the student's handwriting, maps each response to its corresponding question, and calculates precise bounding box coordinates on the page.
4. **Interactive Review**: Clicking any question on the left panel automatically navigates to that page, centers the viewport, and highlights the student's answer with a green bounding box.
5. **AI Grading & Feedback**: Automatically evaluates each answered question (0–10 score, correctness status, and 1–2 sentence pedagogical feedback).

---

## Technical Highlights

### Direct Multimodal Flow (No Separate OCR)
Instead of a traditional brittle pipeline (`Image → OCR engine → Regex/NLP matcher → LLM`), raw PDF and image files are sent directly to Google Gemini via `@google/genai`. Gemini handles visual layout, handwriting transcription, and bounding box coordinates (`[ymin, xmin, ymax, xmax]`) in a single pass, eliminating OCR transcription errors.

### Smart Bounding Box Overlay
- **Coordinate Conversion**: Converts normalized `0–1000` coordinates directly into responsive CSS percentages over the rendered document canvas.
- **Neighbor Midpoint Clamping**: Prevents adjacent sub-parts (like `11a` and `11b`) from overlapping or bleeding into each other by clamping box boundaries to the midpoint between neighboring lines.
- **Single-Line Padding**: Enforces a comfortable minimum box height and horizontal padding so single-line answers aren't sliced through.
- **Auto-Centering**: Automatically calculates the center of the selected answer region and smoothly scrolls it into view.

### Real Classroom Edge Cases Handled
- **Out-of-Order Answers**: Matches answers by question markers and semantic content rather than assuming top-to-bottom page order.
- **Multi-Page Answers**: Supports answers spanning across pages with tabbed navigation (`Page 1`, `Page 2`).
- **Unanswered Questions**: Flags skipped questions with clear status pills and zero scores without breaking layout.
- **Unmatched Handwriting**: Captures rough work and extra student notes in a dedicated bottom drawer with clickable highlight triggers.
- **Grading Prefix Stripping**: Cleans question prefixes (e.g. `2.`, `Q1.`, `Ans:`) before evaluation to prevent false score deductions.
- **Quota Resilience**: Includes automatic fallback cascading across Gemini models (`gemini-3.5-flash-lite`, `gemini-2.5-flash`, `gemini-3.7-flash`) to handle 429 rate limits smoothly.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Vanilla CSS animations
- **AI SDK & Models**: Google GenAI SDK (`@google/genai`) with Gemini Flash
- **PDF Rendering**: `react-pdf` with local PDF.js worker
- **Storage**: IndexedDB for local binary file persistence across reloads

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
