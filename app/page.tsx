"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { UploadDropzone } from "@/components/UploadDropzone";
import { LoadingState } from "@/components/LoadingState";
import { ArrowRightIcon } from "@/components/icons";

export default function UploadPage() {
  const router = useRouter();
  const {
    questionPaperFile,
    questionPaperMeta,
    answerSheetFile,
    answerSheetMeta,
    isExtracting,
    extractionStage,
    errorMessage,
    setQuestionPaper,
    setAnswerSheet,
    setExtractedQuestions,
    setExtractedAnswers,
    setIsExtracting,
    setExtractionStage,
    setErrorMessage,
  } = useApp();

  const [toastError, setToastError] = useState<string | null>(null);

  // Both files must be uploaded to enable Start Mapping
  const isFormComplete = Boolean(questionPaperFile && answerSheetFile);

  const handleStartMapping = async () => {
    if (!isFormComplete || isExtracting) return;

    if (!questionPaperFile) {
      setToastError("Question paper file is missing. Please select your question paper file.");
      return;
    }
    if (!answerSheetFile) {
      setToastError("Answer sheet file is missing. Please select your answer sheet file.");
      return;
    }

    setToastError(null);
    setErrorMessage(null);
    setIsExtracting(true);
    setExtractionStage("uploading");

    try {
      // Step 1: Uploading stage
      await new Promise((res) => setTimeout(res, 600));

      // Step 2: Extracting Questions
      setExtractionStage("extracting-questions");
      const qpFormData = new FormData();
      qpFormData.append("file", questionPaperFile);

      const qpResponse = await fetch("/api/extract-questions", {
        method: "POST",
        body: qpFormData,
      });

      const qpData = await qpResponse.json();

      if (!qpResponse.ok || !qpData.success) {
        throw new Error(
          qpData.error || "Failed to extract questions from the question paper."
        );
      }

      const extractedQuestionsList = qpData.questions || [];
      setExtractedQuestions(extractedQuestionsList);

      // Step 3: Extracting Answers
      setExtractionStage("extracting-answers");
      const asFormData = new FormData();
      asFormData.append("file", answerSheetFile);
      asFormData.append("questions", JSON.stringify(extractedQuestionsList));

      const asResponse = await fetch("/api/extract-answers", {
        method: "POST",
        body: asFormData,
      });

      const asData = await asResponse.json();

      if (!asResponse.ok || !asData.success) {
        throw new Error(
          asData.error || "Failed to extract and map answers from the student answer sheet."
        );
      }

      // Step 4: Mapping Answers
      setExtractionStage("mapping-answers");
      const rawAnswersList = asData.answers || [];
      const rawUnmatchedList = asData.unmatchedAnswers || [];
      setExtractedAnswers(rawAnswersList, rawUnmatchedList);

      await new Promise((res) => setTimeout(res, 500));

      // Step 5: Grading Answers (only for answered: true)
      setExtractionStage("grading-answers");

      const answeredItemsToGrade = extractedQuestionsList
        .map((q: any) => {
          const matched = rawAnswersList.find(
            (a: any) => a.questionId === q.id || a.questionId === q.number
          );
          if (
            matched &&
            matched.answered &&
            matched.extractedText &&
            matched.extractedText.trim().length > 0
          ) {
            return {
              questionId: q.id,
              question: q.text,
              answer: matched.extractedText,
            };
          }
          return null;
        })
        .filter(Boolean);

      let gradedAnswers = [...rawAnswersList];

      if (answeredItemsToGrade.length > 0) {
        try {
          const gradeResponse = await fetch("/api/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: answeredItemsToGrade }),
          });

          const gradeData = await gradeResponse.json();

          if (gradeResponse.ok && gradeData.success && Array.isArray(gradeData.results)) {
            const gradeMap: Record<string, any> = {};
            gradeData.results.forEach((r: any) => {
              gradeMap[r.questionId] = r;
            });

            gradedAnswers = rawAnswersList.map((a: any) => {
              const g = gradeMap[a.questionId] || gradeMap[`q_${a.questionId}`];
              if (g) {
                return {
                  ...a,
                  score: `${g.score}/10`,
                  gradeScore: g.score,
                  maxScore: 10,
                  correct: g.correct,
                  feedback: g.feedback,
                };
              }
              if (!a.answered) {
                return {
                  ...a,
                  score: "0/10",
                  gradeScore: 0,
                  maxScore: 10,
                  correct: false,
                  feedback: "No answer provided on the answer sheet.",
                };
              }
              return a;
            });
          }
        } catch (gradeErr) {
          console.warn("Grading API error (proceeding with mapped answers):", gradeErr);
        }
      }

      setExtractedAnswers(gradedAnswers, rawUnmatchedList);

      await new Promise((res) => setTimeout(res, 400));

      // Redirect to review page
      setIsExtracting(false);
      setExtractionStage("idle");
      router.push("/review");
    } catch (err: any) {
      console.error("Extraction & mapping error:", err);
      setIsExtracting(false);
      setExtractionStage("idle");
      const msg = err.message || "An error occurred during question and answer extraction.";
      setToastError(msg);
      setErrorMessage(msg);
    }
  };

  // Helper for quick testing demo
  const handleLoadSampleFiles = () => {
    const fakeQP = new File(["dummy question content"], "Class_10_maths_unit_test.pdf", {
      type: "application/pdf",
    });
    const fakeAS = new File(["dummy answer content"], "student_1_answer_sheet.pdf", {
      type: "application/pdf",
    });

    setQuestionPaper(fakeQP, {
      name: "Class_10_maths_unit_test.pdf",
      size: "2MB",
      pages: 2,
    });
    setAnswerSheet(fakeAS, {
      name: "student_1_answer_sheet.pdf",
      size: "8MB",
      pages: 6,
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-b from-[#F5F5F5] to-[#E9E5E5] p-3 gap-3">
      {/* Left Sidebar (collapses automatically during loading state as per Figma) */}
      <Sidebar forceCollapsed={isExtracting} />

      {/* Main Right Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden gap-3">
        {/* Floating Pure White Navbar */}
        <Header title="Exams" />

        {/* Content View: Loading or Upload */}
        <main className="flex-1 flex flex-col overflow-y-auto min-h-0 relative">
          {isExtracting ? (
            <LoadingState stage={extractionStage} />
          ) : (
            <div className="w-full flex-1 flex flex-col items-center justify-center px-4 py-2 sm:px-8 sm:py-3 lg:py-4 max-w-5xl mx-auto min-h-full">
              <div className="w-full flex flex-col items-center justify-between gap-3 sm:gap-4 my-auto max-w-3xl">
                {/* Top Title & Subtitle */}
                <div className="flex flex-col items-center text-center">
                  <h1 className="font-heading text-xl sm:text-2xl lg:text-[28px] font-bold text-[#18181B] tracking-tight flex flex-wrap items-center justify-center gap-2">
                    <span>Upload</span>
                    <span className="bg-[#FFEFE7] text-[#FF5722] px-3.5 py-0.5 rounded-xl inline-block font-bold tracking-tight">
                      Question Paper & Answer Sheets
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-[#71717A] mt-1 font-normal">
                    Upload both files to get started
                  </p>
                </div>

                {/* Center Teacher Avatar Illustration Badge */}
                <div className="relative flex items-center justify-center my-0.5">
                  {/* Concentric rings matching Figma */}
                  <div className="w-24 h-24 sm:w-26 sm:h-26 rounded-full bg-gradient-to-b from-[#FFEBE1] via-[#FFD8C7] to-[#FFEBE1] p-1.5 flex items-center justify-center relative shadow-xs">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center relative overflow-hidden shadow-inner p-0.5">
                      <Image
                        src="/teacher-image.png"
                        alt="Teacher Avatar"
                        width={96}
                        height={96}
                        className="w-full h-full object-contain"
                        priority
                      />
                    </div>

                    {/* Satellite Micro Badges matching Figma */}
                    {/* Top Right: Clock */}
                    <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-[#FF7043] text-white flex items-center justify-center shadow-xs">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>

                    {/* Bottom Right: Cloud */}
                    <div className="absolute -right-1 bottom-5 w-4 h-4 rounded-full bg-[#FF7043] text-white flex items-center justify-center shadow-xs">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                      </svg>
                    </div>

                    {/* Bottom Center-Left: Gear/Settings */}
                    <div className="absolute left-4 -bottom-0.5 w-4 h-4 rounded-full bg-[#FF7043] text-white flex items-center justify-center shadow-xs">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </div>

                    {/* Middle Left: Book/Document */}
                    <div className="absolute -left-1 top-5 w-4 h-4 rounded-full bg-[#FF7043] text-white flex items-center justify-center shadow-xs">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <line x1="8" y1="9" x2="16" y2="9" />
                        <line x1="8" y1="13" x2="14" y2="13" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Upload Dropzones Outer Panel matching Figma Frame 1984077325 */}
                <div className="w-full bg-[#EAE7E6]/50 sm:bg-white/40 backdrop-blur-xs p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] border border-white/70 shadow-xs flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                  <UploadDropzone
                    label="Question Paper"
                    file={questionPaperFile}
                    meta={questionPaperMeta}
                    onFileSelect={(file) => setQuestionPaper(file)}
                    onFileRemove={() => setQuestionPaper(null)}
                    disabled={isExtracting}
                  />

                  <UploadDropzone
                    label="Answer Sheet"
                    file={answerSheetFile}
                    meta={answerSheetMeta}
                    onFileSelect={(file) => setAnswerSheet(file)}
                    onFileRemove={() => setAnswerSheet(null)}
                    disabled={isExtracting}
                  />
                </div>

                {/* Bottom Action Area */}
                <div className="flex flex-col items-center gap-1.5 pt-1 pb-1">
                  <button
                    id="start-mapping-btn"
                    onClick={handleStartMapping}
                    disabled={!isFormComplete || isExtracting}
                    className={`px-7 py-2.5 rounded-full font-heading font-medium text-xs sm:text-sm flex items-center gap-2 transition-all duration-200 ${
                      isFormComplete && !isExtracting
                        ? "bg-[#18181B] hover:bg-black text-white cursor-pointer active:scale-98 shadow-md"
                        : "bg-[#BDBDBD] text-white/90 cursor-not-allowed shadow-none"
                    }`}
                  >
                    <span>Start Mapping</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>

                  <p className="text-[11px] sm:text-xs text-[#8E8E93] text-center font-normal">
                    Once both files are uploaded, you&apos;ll able to map answers with questions
                  </p>

                  {/* Quick Demo Autofill Helper */}
                  {(!questionPaperMeta || !answerSheetMeta) && (
                    <button
                      onClick={handleLoadSampleFiles}
                      type="button"
                      className="text-[10px] text-gray-400 hover:text-gray-700 underline underline-offset-2 cursor-pointer mt-0.5"
                    >
                      Quick Fill: Load Figma Sample Files
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Error Toast Notification */}
        {toastError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-bounce">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{toastError}</span>
            <button
              onClick={() => setToastError(null)}
              className="ml-2 text-white/80 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
