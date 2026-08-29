"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  saveFileToStorage,
  getFileFromStorage,
  removeFileFromStorage,
  clearAllStoredFiles,
} from "@/lib/fileStorage";

export interface Question {
  id: string;
  number: string;
  subpart: string;
  text: string;
  page: number;
}

export interface FileMeta {
  name: string;
  size: string;
  pages: number;
  type: string;
}

interface AppContextType {
  questionPaperFile: File | null;
  questionPaperMeta: FileMeta | null;
  answerSheetFile: File | null;
  answerSheetMeta: FileMeta | null;
  extractedQuestions: Question[] | null;
  isExtracting: boolean;
  extractionStage: "idle" | "uploading" | "extracting";
  errorMessage: string | null;
  setQuestionPaper: (file: File | null, meta?: Partial<FileMeta>) => void;
  setAnswerSheet: (file: File | null, meta?: Partial<FileMeta>) => void;
  setExtractedQuestions: (questions: Question[] | null) => void;
  setIsExtracting: (val: boolean) => void;
  setExtractionStage: (stage: "idle" | "uploading" | "extracting") => void;
  setErrorMessage: (msg: string | null) => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [questionPaperFile, setQuestionPaperFile] = useState<File | null>(null);
  const [questionPaperMeta, setQuestionPaperMeta] = useState<FileMeta | null>(null);
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null);
  const [answerSheetMeta, setAnswerSheetMeta] = useState<FileMeta | null>(null);
  const [extractedQuestions, setExtractedQuestionsState] = useState<Question[] | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionStage, setExtractionStage] = useState<"idle" | "uploading" | "extracting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load persisted questions and raw files on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("vedaai_extracted_questions");
      if (saved) {
        setExtractedQuestionsState(JSON.parse(saved));
      }
      const qMeta = sessionStorage.getItem("vedaai_qp_meta");
      if (qMeta) {
        setQuestionPaperMeta(JSON.parse(qMeta));
      }
      const aMeta = sessionStorage.getItem("vedaai_as_meta");
      if (aMeta) {
        setAnswerSheetMeta(JSON.parse(aMeta));
      }
    } catch {
      // Ignore storage errors
    }

    // Restore real files from IndexedDB
    getFileFromStorage("questionPaper").then((qpFile) => {
      if (qpFile) {
        setQuestionPaperFile(qpFile);
        setQuestionPaperMeta((prev) => prev || {
          name: qpFile.name,
          size: formatFileSize(qpFile.size),
          pages: Math.max(1, Math.ceil(qpFile.size / (1.2 * 1024 * 1024))),
          type: qpFile.type || "application/pdf",
        });
      }
    });

    getFileFromStorage("answerSheet").then((asFile) => {
      if (asFile) {
        setAnswerSheetFile(asFile);
        setAnswerSheetMeta((prev) => prev || {
          name: asFile.name,
          size: formatFileSize(asFile.size),
          pages: Math.max(1, Math.ceil(asFile.size / (1.5 * 1024 * 1024))),
          type: asFile.type || "application/pdf",
        });
      }
    });
  }, []);

  const setQuestionPaper = (file: File | null, meta?: Partial<FileMeta>) => {
    setQuestionPaperFile(file);
    if (!file) {
      setQuestionPaperMeta(null);
      removeFileFromStorage("questionPaper");
      try {
        sessionStorage.removeItem("vedaai_qp_meta");
      } catch {}
      return;
    }

    saveFileToStorage("questionPaper", file);

    const estimatedPages = meta?.pages ?? Math.max(1, Math.ceil(file.size / (1.2 * 1024 * 1024)));
    const newMeta: FileMeta = {
      name: file.name,
      size: formatFileSize(file.size),
      pages: estimatedPages,
      type: file.type || "application/pdf",
      ...meta,
    };
    setQuestionPaperMeta(newMeta);
    try {
      sessionStorage.setItem("vedaai_qp_meta", JSON.stringify(newMeta));
    } catch {}
  };

  const setAnswerSheet = (file: File | null, meta?: Partial<FileMeta>) => {
    setAnswerSheetFile(file);
    if (!file) {
      setAnswerSheetMeta(null);
      removeFileFromStorage("answerSheet");
      try {
        sessionStorage.removeItem("vedaai_as_meta");
      } catch {}
      return;
    }

    saveFileToStorage("answerSheet", file);

    const estimatedPages = meta?.pages ?? Math.max(1, Math.ceil(file.size / (1.5 * 1024 * 1024)));
    const newMeta: FileMeta = {
      name: file.name,
      size: formatFileSize(file.size),
      pages: estimatedPages,
      type: file.type || "application/pdf",
      ...meta,
    };
    setAnswerSheetMeta(newMeta);
    try {
      sessionStorage.setItem("vedaai_as_meta", JSON.stringify(newMeta));
    } catch {}
  };

  const setExtractedQuestions = (questions: Question[] | null) => {
    setExtractedQuestionsState(questions);
    try {
      if (questions) {
        sessionStorage.setItem("vedaai_extracted_questions", JSON.stringify(questions));
      } else {
        sessionStorage.removeItem("vedaai_extracted_questions");
      }
    } catch {}
  };

  const resetAll = () => {
    setQuestionPaperFile(null);
    setQuestionPaperMeta(null);
    setAnswerSheetFile(null);
    setAnswerSheetMeta(null);
    setExtractedQuestionsState(null);
    setIsExtracting(false);
    setExtractionStage("idle");
    setErrorMessage(null);
    clearAllStoredFiles();
    try {
      sessionStorage.clear();
    } catch {}
  };

  return (
    <AppContext.Provider
      value={{
        questionPaperFile,
        questionPaperMeta,
        answerSheetFile,
        answerSheetMeta,
        extractedQuestions,
        isExtracting,
        extractionStage,
        errorMessage,
        setQuestionPaper,
        setAnswerSheet,
        setExtractedQuestions,
        setIsExtracting,
        setExtractionStage,
        setErrorMessage,
        resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
