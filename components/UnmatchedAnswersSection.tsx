"use client";

import React, { useState } from "react";
import { UnmatchedAnswer, AnswerRegion } from "@/context/AppContext";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";

interface UnmatchedAnswersSectionProps {
  unmatchedAnswers: UnmatchedAnswer[];
  activeUnmatchedRegion: AnswerRegion | null;
  onSelectUnmatched: (region: AnswerRegion | null) => void;
  onViewAnswerSheet?: () => void;
}

export function UnmatchedAnswersSection({
  unmatchedAnswers,
  activeUnmatchedRegion,
  onSelectUnmatched,
  onViewAnswerSheet,
}: UnmatchedAnswersSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!unmatchedAnswers || unmatchedAnswers.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#FFFDF5] rounded-2xl border border-amber-200 shadow-xs overflow-hidden mt-4">
      {/* Header with expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-amber-50/80 hover:bg-amber-100/80 transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-heading font-bold text-xs sm:text-sm text-amber-900">
            Unmatched Handwriting ({unmatchedAnswers.length})
          </span>
          <span className="text-[11px] text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full font-medium">
            Not linked to question
          </span>
        </div>

        <div className="p-1 rounded-md text-amber-800">
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* List of unmatched items */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-2.5 bg-white border-t border-amber-100">
          <p className="text-xs text-gray-500 mb-2">
            Click any unmatched text below to highlight its bounding box on the answer sheet:
          </p>

          {unmatchedAnswers.map((item, idx) => {
            const firstRegion = item.regions?.[0] || null;
            const isSelected =
              activeUnmatchedRegion &&
              firstRegion &&
              activeUnmatchedRegion.page === firstRegion.page &&
              activeUnmatchedRegion.bbox[0] === firstRegion.bbox[0];

            return (
              <div
                key={idx}
                onClick={() => {
                  if (isSelected) {
                    onSelectUnmatched(null);
                  } else {
                    onSelectUnmatched(firstRegion);
                    if (onViewAnswerSheet) onViewAnswerSheet();
                  }
                }}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? "bg-amber-50/80 border-amber-500 shadow-sm ring-1 ring-amber-400"
                    : "bg-gray-50/60 border-gray-200 hover:border-amber-300 hover:bg-amber-50/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-800 leading-relaxed font-sans">
                    {item.extractedText || "Handwritten margin content"}
                  </p>
                  {firstRegion && (
                    <span className="shrink-0 font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                      Page {firstRegion.page}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
