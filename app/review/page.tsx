"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { BackArrowIcon, SparkleSingleIcon } from "@/components/icons";

export default function ReviewPage() {
  const router = useRouter();
  const { extractedQuestions, questionPaperMeta, answerSheetMeta } = useApp();
  const [copied, setCopied] = useState(false);

  const jsonString = extractedQuestions
    ? JSON.stringify(extractedQuestions, null, 2)
    : "[]";

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0F1F5]">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col my-3 mr-3 ml-3 lg:ml-0 bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#ECEEF2] overflow-hidden">
        <Header
          title="Review Extracted Questions"
          onBackClick={() => router.push("/")}
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFE8DC] text-[#FF5722] text-xs font-semibold">
                    Step 2 • Review
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    gemini-3.6-flash
                  </span>
                </div>
                <h1 className="font-heading text-2xl font-bold text-gray-900 mt-1">
                  Extracted Questions (Raw JSON)
                </h1>
                <p className="text-sm text-gray-500">
                  {extractedQuestions?.length || 0} questions extracted from{" "}
                  <span className="font-medium text-gray-800">
                    {questionPaperMeta?.name || "Uploaded Question Paper"}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => router.push("/")}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <BackArrowIcon className="w-4 h-4" />
                  Upload Again
                </button>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#303030] hover:bg-[#1A1A1A] transition-colors shadow-sm flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Metadata Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-[#E9ECEF]">
                <span className="text-xs text-gray-500 font-medium">Question Paper</span>
                <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                  {questionPaperMeta?.name || "Not uploaded"}
                </p>
                <span className="text-xs text-gray-400">
                  {questionPaperMeta?.size || "—"}
                </span>
              </div>

              <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-[#E9ECEF]">
                <span className="text-xs text-gray-500 font-medium">Student Answer Sheet</span>
                <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                  {answerSheetMeta?.name || "Not uploaded"}
                </p>
                <span className="text-xs text-gray-400">
                  {answerSheetMeta?.size || "—"}
                </span>
              </div>

              <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-[#E9ECEF]">
                <span className="text-xs text-gray-500 font-medium">Total Extracted Items</span>
                <p className="text-xl font-bold text-[#FF5722] mt-0.5">
                  {extractedQuestions?.length || 0} Questions
                </p>
                <span className="text-xs text-gray-400">
                  Schema: id, number, subpart, text, page
                </span>
              </div>
            </div>

            {/* JSON Code Viewer */}
            <div className="rounded-2xl bg-[#1E1E24] text-gray-200 p-5 shadow-inner border border-gray-800 relative font-mono text-xs lg:text-sm overflow-x-auto max-h-[500px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                  <span className="ml-2 text-gray-400 font-sans">questions_schema.json</span>
                </div>
                <span>{jsonString.length} chars</span>
              </div>

              {extractedQuestions && extractedQuestions.length > 0 ? (
                <pre className="text-emerald-400 leading-relaxed">
                  <code>{jsonString}</code>
                </pre>
              ) : (
                <div className="py-12 text-center text-gray-400">
                  <p>No questions extracted yet.</p>
                  <button
                    onClick={() => router.push("/")}
                    className="mt-3 px-4 py-1.5 rounded-lg bg-[#303030] text-white text-xs hover:bg-[#404040]"
                  >
                    Go back to upload
                  </button>
                </div>
              )}
            </div>

            {/* Structured Table / List Preview */}
            {extractedQuestions && extractedQuestions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                  Structured Questions Summary
                </div>
                <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                  {extractedQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="p-4 hover:bg-gray-50/80 transition-colors flex items-start gap-4">
                      <div className="px-2.5 py-1 rounded-lg bg-[#FFE8DC] text-[#FF5722] font-bold text-xs shrink-0">
                        {q.number}{q.subpart ? `(${q.subpart})` : ""}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                          {q.text}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span>ID: <code className="text-gray-600 font-mono">{q.id}</code></span>
                          <span>•</span>
                          <span>Page {q.page}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
