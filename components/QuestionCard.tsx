"use client";

import React from "react";
import { Question, MatchedAnswer, AnswerRegion } from "@/context/AppContext";
import { ChevronDownIcon, ChevronUpIcon, SparkleSingleIcon } from "./icons";

interface QuestionCardProps {
  question: Question;
  matchedAnswer?: MatchedAnswer;
  isSelected: boolean;
  isExpanded: boolean;
  activeRegionIndex: number;
  onSelect: () => void;
  onToggleExpand: () => void;
  onSelectRegion: (index: number) => void;
  onViewAnswerSheet?: () => void;
}

export function QuestionCard({
  question,
  matchedAnswer,
  isSelected,
  isExpanded,
  activeRegionIndex,
  onSelect,
  onToggleExpand,
  onSelectRegion,
  onViewAnswerSheet,
}: QuestionCardProps) {
  const isAnswered = Boolean(
    matchedAnswer?.answered || (matchedAnswer?.regions && matchedAnswer.regions.length > 0)
  );

  const scoreBadge = matchedAnswer?.score || (isAnswered ? "2/2" : "0/2");

  const regions: AnswerRegion[] = matchedAnswer?.regions || [];

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected
          ? "bg-white border-2 border-[#FF7043] shadow-md ring-2 ring-[#FF5722]/10"
          : "bg-white border border-[#ECEEF2] hover:border-gray-300 hover:shadow-xs"
      }`}
    >
      {/* Main Card Header / Row matching Figma */}
      <div className="p-3.5 sm:p-4 flex items-start justify-between gap-3">
        {/* Left: Question Number Circle + Subpart + Text */}
        <div className="flex items-start gap-3 flex-1">
          {/* Question Number Badge */}
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                isSelected
                  ? "bg-[#FF5722] text-white"
                  : "bg-[#303030] text-white"
              }`}
            >
              {question.number}
            </div>

            {/* Subpart indicator e.g. 11 a. / 11 b. */}
            {question.subpart && (
              <span className="font-bold text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {question.subpart}.
              </span>
            )}
          </div>

          {/* Question Text */}
          <p className="text-xs sm:text-sm font-medium text-[#18181B] leading-snug pt-0.5">
            {question.text}
          </p>
        </div>

        {/* Right: Status Pill & Accordion Toggle */}
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {/* Status Badge */}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-tight shadow-xs ${
              isAnswered
                ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                : "bg-[#FFE8DC] text-[#FF5722] border border-[#FFCCBC]"
            }`}
          >
            {scoreBadge}
          </span>

          {/* Accordion Chevron Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            title={isExpanded ? "Collapse details" : "Expand details"}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Accordion Area (Matching Figma AI Feedback Card) */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-0 border-t border-gray-100 mt-1 flex flex-col gap-2.5 animate-fadeIn">
          {/* AI Feedback Box */}
          <div className="bg-[#F9FAFB] rounded-xl p-3 sm:p-3.5 border border-[#F3F4F6] mt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#18181B] mb-1">
              <SparkleSingleIcon className="w-3.5 h-3.5 text-[#FF5722]" />
              <span>AI Feedback</span>
            </div>

            <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              {matchedAnswer?.feedback ||
                (isAnswered
                  ? "Correctly identified and mapped from student answer sheet. Response matches question expectations."
                  : "No answer found for this question on the answer sheet.")}
            </p>

            {/* Extracted Handwritten Answer Text if present */}
            {matchedAnswer?.extractedText && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Extracted Handwritten Text
                </span>
                <p className="text-xs text-gray-800 italic bg-white p-2 rounded-lg border border-gray-200 font-mono whitespace-pre-wrap leading-relaxed">
                  &ldquo;{matchedAnswer.extractedText}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Multi-page Region Selector Tabs */}
          {regions.length > 1 && (
            <div className="flex items-center gap-2 bg-[#F4F5F8] p-2 rounded-xl border border-gray-200">
              <span className="text-xs font-medium text-gray-600">
                Answer spans {regions.length} pages:
              </span>
              <div className="flex items-center gap-1.5">
                {regions.map((reg, rIdx) => (
                  <button
                    key={rIdx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRegion(rIdx);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-all ${
                      activeRegionIndex === rIdx
                        ? "bg-[#FF5722] text-white shadow-xs"
                        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    Page {reg.page}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mobile view shortcut */}
          {onViewAnswerSheet && isAnswered && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewAnswerSheet();
              }}
              className="lg:hidden text-xs font-semibold text-[#FF5722] hover:text-[#E64A19] flex items-center justify-end gap-1 mt-1"
            >
              <span>View highlighted region on Answer Sheet</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
