"use client";

import React from "react";
import { Question, MatchedAnswer } from "@/context/AppContext";
import { SparkleSingleIcon } from "./icons";

interface GradingSummaryPanelProps {
  questions: Question[];
  answers: MatchedAnswer[];
}

export function GradingSummaryPanel({
  questions,
  answers,
}: GradingSummaryPanelProps) {
  // Calculate summary metrics
  let totalScore = 0;
  let totalPossible = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  questions.forEach((q) => {
    const matched = answers.find(
      (a) =>
        a.questionId === q.id ||
        a.questionId === q.number ||
        a.questionId === `q_${q.id}`
    );

    const isAnswered = Boolean(
      matched &&
        matched.answered &&
        (matched.extractedText?.trim().length > 0 ||
          (matched.regions && matched.regions.length > 0))
    );

    if (!isAnswered) {
      unansweredCount++;
      totalPossible += 10;
      return;
    }

    let earned = 8;
    let max = 10;

    if (matched?.gradeScore !== undefined) {
      earned = matched.gradeScore;
      max = matched.maxScore || 10;
    } else if (matched?.score && matched.score.includes("/")) {
      const [num, den] = matched.score.split("/").map(Number);
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        earned = num;
        max = den;
      }
    }

    totalScore += earned;
    totalPossible += max;

    const isCorrect =
      matched?.correct !== undefined
        ? matched.correct
        : earned / max >= 0.6;

    if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const percentage =
    totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  return (
    <div className="bg-[#FAFBFD] rounded-2xl border border-[#ECEEF2] p-4 shadow-xs mb-3 flex flex-col gap-3">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#303030] text-white flex items-center justify-center shadow-xs">
            <SparkleSingleIcon className="w-3.5 h-3.5 text-[#FF5722]" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-[#18181B] tracking-tight">
              Evaluation & Grading Summary
            </h3>
            <p className="text-[11px] text-[#71717A]">
              Graded with Gemini Flash AI
            </p>
          </div>
        </div>

        {/* Total Score Badge */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-xs text-gray-500 font-medium block leading-none">
              Total Score
            </span>
            <span className="font-heading font-extrabold text-base text-[#18181B]">
              {totalScore} <span className="text-xs font-semibold text-gray-400">/ {totalPossible}</span>
            </span>
          </div>

          <div className="bg-[#FFE8DC] text-[#FF5722] font-bold text-xs px-2.5 py-1 rounded-xl shadow-xs">
            {percentage}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF7043] to-[#10B981] rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Breakdown Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {/* Correct Count */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] text-xs font-bold shadow-2xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>{correctCount} Correct</span>
        </span>

        {/* Incorrect Count */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEECEB] text-[#D32F2F] border border-[#FFCDD2] text-xs font-bold shadow-2xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span>{incorrectCount} Incorrect</span>
        </span>

        {/* Unanswered Count */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFE8DC] text-[#FF5722] border border-[#FFCCBC] text-xs font-bold shadow-2xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{unansweredCount} Unanswered</span>
        </span>

        {/* Total Questions Counter */}
        <span className="ml-auto text-xs text-gray-500 font-medium">
          {questions.length} total questions
        </span>
      </div>
    </div>
  );
}
