"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { QuestionCard } from "@/components/QuestionCard";
import { AnswerSheetViewer } from "@/components/AnswerSheetViewer";
import { UnmatchedAnswersSection } from "@/components/UnmatchedAnswersSection";
import { GradingSummaryPanel } from "@/components/GradingSummaryPanel";
import {
  SAMPLE_QUESTIONS,
  SAMPLE_MATCHED_ANSWERS,
  SAMPLE_UNMATCHED_ANSWERS,
} from "@/lib/sampleData";
import { AnswerRegion, MatchedAnswer, Question } from "@/context/AppContext";

/**
 * Robust matcher that links a question to its student answer even if answers were written
 * out of order, or if question IDs use numbers ("1"), subparts ("1a"), or prefixes ("q_1", "Q1").
 */
export function findMatchedAnswer(
  answersList: MatchedAnswer[],
  q: Question
): MatchedAnswer | undefined {
  if (!answersList || answersList.length === 0) return undefined;

  const targetId = String(q.id).trim().toLowerCase();
  const targetNum = String(q.number).trim().toLowerCase();
  const subpart = String(q.subpart || "").trim().toLowerCase();
  const targetCombined = `${targetNum}${subpart}`;

  // 1. Direct ID matches
  const directMatch = answersList.find((a) => {
    const aId = String(a.questionId).trim().toLowerCase();
    return (
      aId === targetId ||
      aId === targetCombined ||
      aId === targetNum ||
      aId === `q_${targetId}` ||
      aId === `q${targetId}` ||
      aId.replace(/^q(?:uestion)?_?/i, "") === targetId ||
      aId.replace(/^q(?:uestion)?_?/i, "") === targetCombined
    );
  });
  if (directMatch) return directMatch;

  // 2. Normalized alphanumeric match
  const alphaTarget = targetId.replace(/[^a-z0-9]/gi, "");
  const alphaCombined = targetCombined.replace(/[^a-z0-9]/gi, "");
  const alphaNum = targetNum.replace(/[^a-z0-9]/gi, "");

  return answersList.find((a) => {
    const aId = String(a.questionId).trim().toLowerCase();
    const cleanA = aId.replace(/[^a-z0-9]/gi, "");
    return (
      cleanA === alphaTarget ||
      cleanA === alphaCombined ||
      (subpart === "" && cleanA === alphaNum)
    );
  });
}

export default function ReviewPage() {
  const router = useRouter();
  const {
    extractedQuestions,
    extractedAnswers,
    unmatchedAnswers,
    answerSheetFile,
  } = useApp();

  // Prefer extracted data, fall back to high-fidelity Figma sample data
  const questions = useMemo(() => {
    return extractedQuestions && extractedQuestions.length > 0
      ? extractedQuestions
      : SAMPLE_QUESTIONS;
  }, [extractedQuestions]);

  const answers = useMemo(() => {
    return extractedAnswers && extractedAnswers.length > 0
      ? extractedAnswers
      : SAMPLE_MATCHED_ANSWERS;
  }, [extractedAnswers]);

  const unmatched = useMemo(() => {
    return unmatchedAnswers && unmatchedAnswers.length > 0
      ? unmatchedAnswers
      : SAMPLE_UNMATCHED_ANSWERS;
  }, [unmatchedAnswers]);

  // Aggregate all regions across matched and unmatched answers for collision/neighbor detection
  const allPageRegions = useMemo(() => {
    const list: AnswerRegion[] = [];
    answers.forEach((a) => {
      if (a.regions) {
        a.regions.forEach((r) => list.push(r));
      }
    });
    unmatched.forEach((u) => {
      if (u.regions) {
        u.regions.forEach((r) => list.push(r));
      }
    });
    return list;
  }, [answers, unmatched]);

  // Active states
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [activeRegionIndex, setActiveRegionIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeUnmatchedRegion, setActiveUnmatchedRegion] =
    useState<AnswerRegion | null>(null);

  // Synchronize initial question selection when questions array loads
  useEffect(() => {
    if (questions && questions.length > 0 && !selectedQuestionId) {
      const initialQ = questions[0];
      setSelectedQuestionId(initialQ.id);
      setExpandedQuestions(new Set([initialQ.id]));

      const matched = findMatchedAnswer(answers, initialQ);
      if (matched && matched.regions && matched.regions.length > 0) {
        if (matched.regions[0].page) {
          setCurrentPage(matched.regions[0].page);
        }
      }
    }
  }, [questions, answers, selectedQuestionId]);

  // Mobile segmented toggle: "questions" vs "answers"
  const [mobileTab, setMobileTab] = useState<"questions" | "answers">(
    "questions"
  );

  // Expand / Collapse All
  const areAllExpanded = expandedQuestions.size === questions.length;

  const handleToggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedQuestions(new Set());
    } else {
      setExpandedQuestions(new Set(questions.map((q) => q.id)));
    }
  };

  const handleSelectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    setActiveUnmatchedRegion(null);
    setActiveRegionIndex(0);

    // Expand the selected question card
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      next.add(qId);
      return next;
    });

    // Determine target page from answer region
    const targetQ = questions.find((q) => q.id === qId);
    if (targetQ) {
      const matched = findMatchedAnswer(answers, targetQ);
      if (matched && matched.regions && matched.regions.length > 0) {
        const region = matched.regions[0];
        if (region.page) {
          setCurrentPage(region.page);
        }
      }
    }
  };

  const handleToggleQuestionExpand = (qId: string) => {
    setSelectedQuestionId(qId);
    setActiveUnmatchedRegion(null);
    setActiveRegionIndex(0);

    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });

    const targetQ = questions.find((q) => q.id === qId);
    if (targetQ) {
      const matched = findMatchedAnswer(answers, targetQ);
      if (matched && matched.regions && matched.regions.length > 0) {
        const region = matched.regions[0];
        if (region.page) {
          setCurrentPage(region.page);
        }
      }
    }
  };

  // Find active region for the selected question
  const activeQuestionObj = useMemo(() => {
    return questions.find((q) => q.id === selectedQuestionId);
  }, [questions, selectedQuestionId]);

  const activeMatchedAnswer = useMemo(() => {
    if (!activeQuestionObj) return undefined;
    return findMatchedAnswer(answers, activeQuestionObj);
  }, [answers, activeQuestionObj]);

  const activeRegion = useMemo<AnswerRegion | null>(() => {
    if (activeUnmatchedRegion) return null;
    if (!activeMatchedAnswer || !activeMatchedAnswer.regions) return null;
    return activeMatchedAnswer.regions[activeRegionIndex] || null;
  }, [activeMatchedAnswer, activeRegionIndex, activeUnmatchedRegion]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0F1F5]">
      {/* Left Collapsible Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col my-3 mr-3 ml-3 lg:ml-0 bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#ECEEF2] overflow-hidden relative">
        {/* Header matching Figma */}
        <Header
          title="Exams"
          onBackClick={() => router.push("/")}
        />

        {/* Mobile View Toggle Bar matching Phone Screenshot */}
        <div className="lg:hidden px-4 py-2.5 bg-[#F0F1F5] border-b border-[#ECEEF2] flex items-center justify-center shrink-0">
          <div className="bg-[#E5E7EB] p-1 rounded-full flex items-center gap-1 w-full max-w-sm">
            <button
              onClick={() => setMobileTab("questions")}
              className={`flex-1 py-2 rounded-full font-heading font-medium text-xs transition-all ${
                mobileTab === "questions"
                  ? "bg-[#303030] text-white shadow-sm"
                  : "text-[#4B5563] hover:text-[#18181B]"
              }`}
            >
              Questions
            </button>
            <button
              onClick={() => setMobileTab("answers")}
              className={`flex-1 py-2 rounded-full font-heading font-medium text-xs transition-all ${
                mobileTab === "answers"
                  ? "bg-[#303030] text-white shadow-sm"
                  : "text-[#4B5563] hover:text-[#18181B]"
              }`}
            >
              Answer Sheet
            </button>
          </div>
        </div>

        {/* Split Panel Layout (Desktop: Side-by-Side, Mobile: Tab Controlled) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-4 lg:p-5 gap-4">
          {/* Left Panel: Questions List */}
          <div
            className={`flex-1 lg:max-w-[48%] flex flex-col h-full overflow-hidden ${
              mobileTab === "questions" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Panel Header matching Figma */}
            <div className="flex items-center justify-between pb-3 px-1 shrink-0">
              <h2 className="font-heading font-bold text-sm sm:text-base text-[#18181B] tracking-tight">
                Extracted Questions (from question paper)
              </h2>

              <button
                onClick={handleToggleExpandAll}
                className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-xs transition-all"
              >
                {areAllExpanded ? "Collapse All" : "Expand All"}
              </button>
            </div>

            {/* Scrollable Questions List */}
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3 pb-6">
              {/* Grading Summary Overview */}
              <GradingSummaryPanel questions={questions} answers={answers} />

              {questions.map((question) => {
                const matched = findMatchedAnswer(answers, question);
                const isSelected = selectedQuestionId === question.id;
                const isExpanded = expandedQuestions.has(question.id);

                return (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    matchedAnswer={matched}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    activeRegionIndex={
                      isSelected ? activeRegionIndex : 0
                    }
                    onSelect={() => handleSelectQuestion(question.id)}
                    onToggleExpand={() =>
                      handleToggleQuestionExpand(question.id)
                    }
                    onSelectRegion={(idx) => {
                      setActiveRegionIndex(idx);
                      if (matched?.regions?.[idx]?.page) {
                        setCurrentPage(matched.regions[idx].page);
                      }
                    }}
                    onViewAnswerSheet={() => setMobileTab("answers")}
                  />
                );
              })}

              {/* Unmatched Answers Section at Bottom */}
              <UnmatchedAnswersSection
                unmatchedAnswers={unmatched}
                activeUnmatchedRegion={activeUnmatchedRegion}
                onSelectUnmatched={(region) => {
                  setActiveUnmatchedRegion(region);
                  if (region?.page) {
                    setCurrentPage(region.page);
                  }
                }}
                onViewAnswerSheet={() => setMobileTab("answers")}
              />
            </div>
          </div>

          {/* Right Panel: Answer Sheet Viewer */}
          <div
            className={`flex-1 flex flex-col h-full overflow-hidden ${
              mobileTab === "answers" ? "flex" : "hidden lg:flex"
            }`}
          >
            <AnswerSheetViewer
              file={answerSheetFile}
              activeRegion={activeRegion}
              activeQuestionNumber={
                activeQuestionObj
                  ? `${activeQuestionObj.number}${activeQuestionObj.subpart || ""}`
                  : "1"
              }
              unmatchedRegion={activeUnmatchedRegion}
              currentPage={currentPage}
              onPageChange={(p) => setCurrentPage(p)}
              totalPages={1}
              allRegions={allPageRegions}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
