# VedaAI — AI Assessment Extraction & Answer Mapping

A Next.js application that automates the tedious parts of grading written tests. A teacher uploads a question paper and a student's handwritten answer sheet (PDF or image). The system extracts all questions in order (including sub-parts like 11(a) and 11(b)), transcribes the handwritten answers, maps each answer to its corresponding question, draws interactive bounding boxes over the student's sheet when a question is selected, and grades each response with AI feedback and a score.

---

## What It Actually Does

When evaluating student assessments, grading isn't just about reading text; it's about navigating a physical document where handwriting is messy, answers are written out of order, and responses carry across page breaks. 

Here is how the application works in practice:

1. **Upload & Ingestion**: The teacher uploads two files on the dashboard — the printed Question Paper and one student's handwritten Answer Sheet (supports multi-page PDFs and standard image formats like PNG/JPEG). Files are cached locally in browser IndexedDB so refreshing or switching tabs won't lose uploaded binaries.
2. **Question Extraction (`/api/extract-questions`)**: The question paper is parsed to identify every question in printed sequence. Compound questions with sub-parts (e.g., question 11 with parts (a) and (b)) are split into discrete question entities (`11a`, `11b`) so they can be tracked and graded independently.
3. **Answer Extraction & Mapping (`/api/extract-answers`)**: The answer sheet is sent alongside the extracted question schema. The model reads the handwriting, links each answer to its matching question ID, flags skipped/unanswered questions, collects stray handwriting that doesn't belong to any question, and returns normalized bounding box coordinates for every response on the page.
4. **AI Grading (`/api/grade`)**: Each extracted student answer is evaluated against the question prompt, receiving a score out of 10, a correctness status, and a short 1–2 sentence pedagogical explanation.
5. **Interactive Review Workspace (`/review`)**: A split-view interface renders the questions, scores, and feedback on the left panel, and the real uploaded PDF/image on the right panel. Clicking any question smoothly scrolls the viewer to the exact vertical center of that answer on the sheet and overlays a rounded highlight box with a `Q{Number}` badge.

---

## The Technical Flow: Why Direct Multimodal Ingestion (No Separate OCR)

Traditional document processing pipelines use a multi-step waterfall:
```
Raw Image/PDF ──> OCR Engine (Tesseract/AWS Textract) ──> Regex / Layout Heuristics ──> LLM Text Matcher
```

In practice, that pipeline breaks down on student assessments for two big reasons:

1. **Handwriting OCR degradation**: OCR engines frequently mutilate student handwriting. They drop punctuation, butcher mathematical expressions (exponents, square roots, fractions), and garble question labels (turning `11(a)` into `11 a`, `lla`, or missing it entirely). When the upstream OCR output is garbled, downstream regex and text matching fail completely.
2. **Loss of spatial context**: Traditional OCR flattens the document into raw text blocks, discarding the two-dimensional spatial context of where answers live relative to margins, rule lines, and question headers.

Instead, this codebase sends the raw PDF or image base64 payload directly to Gemini via its native multimodal API in a single call. 

Gemini inspects visual layout, handwritten character shapes, and semantic meaning simultaneously. In one pass, it transcribes the text, resolves which question it answers (even if the student wrote `Ans 2` before `Ans 1`), and outputs precise `[ymin, xmin, ymax, xmax]` coordinates directly aligned with the visual canvas. Bypassing OCR eliminates cascading transcription errors and drastically simplifies the backend architecture.

---

## How Bounding Box Highlighting Works Technically

Gemini returns bounding boxes using a normalized `0–1000` coordinate space:
`[ymin, xmin, ymax, xmax]` where `[0, 0]` represents the top-left corner of the page and `[1000, 1000]` represents the bottom-right corner.

### 1. Percentage-Based Canvas Positioning
In `components/AnswerSheetViewer.tsx`, the raw coordinates are converted directly to CSS percentage properties relative to an anchor wrapper locked 1:1 to the rendered document element:

```typescript
const rawTop = ymin / 10;           // percentage from top
const rawLeft = xmin / 10;          // percentage from left
const rawHeight = (ymax - ymin) / 10; // height percentage
const rawWidth = (xmax - xmin) / 10;  // width percentage
```

Whether rendering a vector PDF page via `react-pdf` (`pdfjs-dist`) or a standard raster image (`<img>`), the highlight container matches the exact rendered dimensions (`clientWidth` × `clientHeight`). As the user zooms between `75%` and `200%` or resizes the browser window, `ResizeObserver` recalculates dimensions and the overlays scale in lockstep without coordinate drift.

### 2. Neighbor Midpoint Clamping (Subpart Isolation)
Raw bounding boxes from AI models on handwritten text have edge-case quirks. When subparts are written in close vertical proximity (for instance, line `11(a)` directly above line `11(b)`), simply applying static padding around `11(a)` causes its bottom border to bleed into `11(b)`.

The `computePaddedBoxStyle` function prevents this by computing dynamic midpoints:
- It iterates through all other answer regions on the same page.
- It finds the immediate neighbor above and below the active region.
- It clamps the top edge of the active box so it never crosses the midpoint between its top and the line above (`maxTopBound = (neighborBottom + thisTop) / 2`).
- It clamps the bottom edge so it never crosses the midpoint between its bottom and the line below (`minBottomBound = (thisBottom + neighborTop) / 2`).

### 3. Single-Line Height & Margin Padding
Single-line answers (like `2. x = 5`) produce very small raw bounding box heights (~1.5–2.5% of page height). Without adjustment, rounded corner borders (`rounded-xl`) slice straight through uppercase letters and descenders.

The layout engine enforces:
- A minimum visual box height of `3.6%` (~28–34px) for readability.
- A base horizontal padding of `1.6%` (~12–16px) so character ascenders and question labels aren't clipped at the boundary.
- Clean straight horizontal borders that frame the text without cramping.

### 4. Automatic Viewport Centering
When a question is selected in the left panel, the viewer calculates the absolute vertical center of the target bounding box:

```typescript
const bboxCenterY = pageTopOffset + ((ymin + ymax) / 2000) * pageHeight;
const targetScrollTop = bboxCenterY - (containerHeight / 2);
```

The scroll container executes a smooth scroll to `targetScrollTop`, instantly bringing the student's answer into view without requiring manual panning.

---

## Edge Cases Handled in Practice

Building for real classrooms means handling how students actually write tests rather than assuming ideal document structure:

* **Out-of-Order Answers**: Students frequently answer questions non-sequentially (e.g. answering Q2 first, then Q11, then Q1). The extraction prompt explicitly forbids top-to-bottom sequential assumptions and matches answers based on written question markers and semantic content. The frontend uses a fuzzy identifier normalizer (`findMatchedAnswer`) to connect IDs across variations like `1`, `1a`, `q_1`, and `Ans 1`.
* **Unanswered / Skipped Questions**: When a student skips a question, the API returns `answered: false` with empty regions. The review UI shows a distinct peach "Unanswered" pill (`0/10`), skips bounding box rendering, and displays helpful explanation text instead of breaking.
* **Multi-Page Answers**: Long mathematical derivations or essays often span across two or more pages. Each matched answer contains a `regions` array (`[{ page: 1, bbox: [...] }, { page: 2, bbox: [...] }]`). The question card renders page-switcher tabs ("Page 1", "Page 2"); clicking a tab switches the PDF viewer to that page and auto-centers the respective region.
* **Unmatched Handwriting / Scratch Work**: Students often write scratch calculations, notes to the teacher, or unnumbered working. Rather than throwing this text away or hallucinating a link to an unrelated question, the model categorizes it under `unmatchedAnswers`. An expandable drawer at the bottom of the review screen lets the teacher inspect these snippets and click them to highlight their location on the sheet.
* **Question Number Prefix Stripping for Grading**: When an answer like `2. x = 5` was passed to the grading prompt, the model occasionally hallucinated that the student's answer was `2` (the question number) instead of `$x = 5$`, resulting in false 0/10 grades. The grading endpoint uses a regex pre-processor (`stripQuestionPrefix`) to strip markers (`Q1.`, `Ans 2:`, `11(a)`, `(i)`) so only the substantive response is evaluated.
* **API Quotas & Multi-Model Fallbacks**: Experimental model endpoints in Google AI Studio free tier often enforce tight daily caps (e.g. 20 requests/day) or return 429 quota exhaustion errors. The centralized client in `lib/gemini.ts` catches 429 and 503 errors and cascades through a fallback priority list (`GEMINI_MODEL` → `gemini-3.5-flash-lite` → `gemini-2.5-flash` → `gemini-3.7-flash`). Batch grading concurrency is also throttled to chunks of 2 to avoid bursting the rate limit.
* **IndexedDB Binary File Persistence**: Standard browser `sessionStorage` cannot serialize raw binary `File` objects across page reloads. A custom IndexedDB storage module (`lib/fileStorage.ts`) caches uploaded PDFs/images so browser reloads or route transitions retain the actual binary file without resetting to empty states.

---

## Known Limitations & Honest Trade-offs

* **Bounding box precision depends on handwriting neatness**: If a student's handwriting is heavily slanted, wanders across lines, or lacks clear line breaks, the predicted bounding box may be slightly loose or enclose neighboring margin notes.
* **Matching relies on visible question labels when content is short**: If a student writes a brief answer (e.g. `"True"` or `"x = 4"`) without writing any question number (`"1."`, `"Ans:"`), semantic matching alone may not have enough context to distinguish which question was intended, leading to potential misattribution or moving the text to unmatched answers.
* **Free-tier API latency**: Processing a multi-page PDF through question extraction, answer mapping, and batch grading takes roughly 10–20 seconds on free-tier API quotas.
* **Single student evaluation**: The current workflow is designed to inspect one student's answer sheet per upload session rather than batching an entire classroom roster in a single ZIP.

---

## AI Model & API Used

The project uses the official Google GenAI SDK (`@google/genai`) with **`gemini-3.5-flash-lite`** (and automatic fallbacks to `gemini-2.5-flash` and `gemini-3.7-flash`). Gemini Flash models were chosen because their native multimodal capabilities transcribe messy handwriting and output structured bounding box coordinates in a single low-latency call with generous free-tier limits.

---

## Project Structure

```
VedaAI/
├── vedaai/                   # Next.js 16 (App Router) project root
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract-questions/route.ts  # Question paper extraction
│   │   │   ├── extract-answers/route.ts    # Answer sheet mapping & bbox generation
│   │   │   └── grade/route.ts              # AI scoring and feedback
│   │   ├── review/page.tsx                 # Split-screen review workspace
│   │   ├── globals.css                     # Design tokens & animations
│   │   ├── layout.tsx                      # Root layout & Google fonts
│   │   └── page.tsx                        # Upload landing page
│   ├── components/
│   │   ├── AnswerSheetViewer.tsx           # PDF/Image renderer & bounding box overlays
│   │   ├── QuestionCard.tsx                # Question card with score pills & feedback
│   │   ├── GradingSummaryPanel.tsx         # Total score & progress breakdown
│   │   ├── UnmatchedAnswersSection.tsx     # Unmatched handwriting drawer
│   │   ├── UploadDropzone.tsx              # Drag-and-drop file uploaders
│   │   ├── LoadingState.tsx                # Staged extraction progress indicator
│   │   ├── Header.tsx                      # Floating white navbar
│   │   ├── Sidebar.tsx                     # Collapsible navigation drawer
│   │   └── icons.tsx                       # Custom SVG icons
│   ├── context/
│   │   └── AppContext.tsx                  # Global state management
│   ├── lib/
│   │   ├── gemini.ts                       # Gemini client with multi-model fallback
│   │   ├── fileStorage.ts                  # IndexedDB binary file caching
│   │   └── sampleData.ts                   # Fallback mock data for testing
│   ├── public/
│   │   ├── pdf.worker.min.mjs              # Local PDF.js worker for react-pdf
│   │   └── teacher-image.png               # Teacher dashboard illustration
│   ├── .env.local                          # Local environment variables
│   └── package.json                        # Dependencies and scripts
└── history.md                              # Development change log & root cause analyses
```

---

## Setup & Local Development

### Prerequisites
- Node.js 18.18+ or 20+
- A Google Gemini API key (from [Google AI Studio](https://aistudio.google.com/))

### 1. Clone & Install
The Next.js application lives inside the `vedaai` directory:

```bash
cd vedaai
npm install
```

### 2. Configure Environment Variables
Create or verify `.env.local` inside the `vedaai/` directory:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Optional: override the default primary model (defaults to gemini-3.5-flash-lite)
GEMINI_MODEL=gemini-3.5-flash-lite
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```
