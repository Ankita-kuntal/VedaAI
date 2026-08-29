import React from "react";
import { AnimatedSparkleGroup } from "./icons";
import { ExtractionStage } from "@/context/AppContext";

interface LoadingStateProps {
  stage: ExtractionStage;
}

export function LoadingState({ stage }: LoadingStateProps) {
  const steps: { id: ExtractionStage; label: string }[] = [
    { id: "uploading", label: "1. Uploading" },
    { id: "extracting-questions", label: "2. Extracting Questions" },
    { id: "extracting-answers", label: "3. Extracting Answers" },
    { id: "mapping-answers", label: "4. Mapping Answers" },
    { id: "grading-answers", label: "5. Grading Answers" },
  ];

  const stageIndexMap: Record<ExtractionStage, number> = {
    idle: 0,
    uploading: 0,
    "extracting-questions": 1,
    "extracting-answers": 2,
    "mapping-answers": 3,
    "grading-answers": 4,
  };

  const currentIdx = stageIndexMap[stage] ?? 0;

  const headingText =
    stage === "uploading"
      ? "Uploading..."
      : stage === "extracting-questions"
      ? "Extracting Questions..."
      : stage === "extracting-answers"
      ? "Extracting Answers..."
      : stage === "mapping-answers"
      ? "Mapping Answers..."
      : stage === "grading-answers"
      ? "Grading Answers..."
      : "Processing...";

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 animate-fadeIn">
      {/* Animated Sparkle Stars matching Figma Loading State */}
      <div className="mb-6 relative flex items-center justify-center">
        <AnimatedSparkleGroup className="w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40" />
      </div>

      {/* Main Status Heading */}
      <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#18181B] tracking-tight text-center">
        {headingText}
      </h2>

      {/* Subtitle */}
      <p className="text-sm lg:text-base text-[#71717A] mt-2 text-center font-normal">
        This may take a while
      </p>

      {/* Staged Progress Indicator Pill */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 bg-[#F4F5F8] px-4 py-2.5 rounded-full border border-[#E5E7EB] text-xs font-medium max-w-full">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentIdx;
          const isDone = idx < currentIdx;

          return (
            <React.Fragment key={step.id}>
              {idx > 0 && <span className="text-gray-300 hidden sm:inline">→</span>}
              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all ${
                  isCurrent
                    ? "text-[#FF5722] font-semibold bg-[#FFE8DC]/60"
                    : isDone
                    ? "text-[#10B981] font-medium"
                    : "text-gray-400 font-normal"
                }`}
              >
                {isCurrent && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5722] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5722]" />
                  </span>
                )}
                {isDone && (
                  <svg
                    className="w-3.5 h-3.5 text-[#10B981]"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {step.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
