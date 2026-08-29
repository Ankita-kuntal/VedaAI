"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloudIcon,
  PdfBadgeIcon,
  ImageBadgeIcon,
  CloseIcon,
} from "./icons";
import { FileMeta, formatFileSize } from "@/context/AppContext";

interface UploadDropzoneProps {
  label: "Question Paper" | "Answer Sheet";
  file: File | null;
  meta: FileMeta | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
}

export function UploadDropzone({
  label,
  file,
  meta,
  onFileSelect,
  onFileRemove,
  disabled = false,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  const handleValidateAndSelect = (selectedFile: File) => {
    setErrorMsg(null);

    // Validate size
    if (selectedFile.size > MAX_SIZE_BYTES) {
      setErrorMsg("File exceeds maximum size of 10MB");
      return;
    }

    // Validate type
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];
    if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.endsWith(".pdf")
    ) {
      setErrorMsg("Please upload a PDF or image file (PDF, PNG, JPG, WEBP)");
      return;
    }

    onFileSelect(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleValidateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleValidateAndSelect(e.target.files[0]);
    }
    // Reset value so re-uploading same file name works
    if (inputRef.current) inputRef.current.value = "";
  };

  const isFilled = Boolean(file);

  return (
    <div className="flex-1 w-full flex flex-col">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!isFilled && !disabled) {
            inputRef.current?.click();
          }
        }}
        className={`w-full min-h-[145px] lg:min-h-[160px] rounded-2xl sm:rounded-3xl bg-white flex flex-col items-center justify-center p-4 sm:p-5 transition-all select-none border-2 border-dashed ${
          isDragOver
            ? "border-[#FF5722] bg-[#FFF8F5] scale-[1.01]"
            : "border-[#D6D9E0] hover:border-[#FF5722]/70 hover:bg-[#FAFAFA]"
        } ${!isFilled && !disabled ? "cursor-pointer" : ""}`}
      >
        {isFilled ? (
          /* Filled State Card matching Figma */
          <div className="relative w-full max-w-[320px] sm:max-w-[340px] bg-[#F4F5F8] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-xs border border-[#E5E7EB]">
            <div className="flex items-center gap-3 overflow-hidden pr-3">
              {meta?.type?.includes("image") ? (
                <div className="w-9 h-9 rounded-xl bg-[#3B82F6] text-white flex items-center justify-center shadow-xs shrink-0">
                  <ImageBadgeIcon className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-9 rounded-lg bg-[#EA4335] text-white flex flex-col items-center justify-center font-bold text-[10px] tracking-tight shadow-xs shrink-0">
                  <span>PDF</span>
                </div>
              )}
              <div className="flex flex-col overflow-hidden text-left">
                <span className="text-xs sm:text-sm font-bold text-[#18181B] truncate">
                  {meta?.name || file?.name || "Uploaded document"}
                </span>
                <span className="text-[11px] sm:text-xs text-[#71717A] mt-0.5 font-normal">
                  {meta?.size || (file ? formatFileSize(file.size) : "2MB")}
                  {" • "}
                  {meta?.pages || 2} Pages
                </span>
              </div>
            </div>

            {/* Remove / Close Button Overlapping Top-Right Corner */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove();
              }}
              disabled={disabled}
              className="absolute -top-2.5 -right-2.5 w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-[#3F3F46] hover:bg-[#18181B] text-white flex items-center justify-center shadow-md transition-all hover:scale-110 shrink-0 z-10 cursor-pointer"
              title="Remove file"
            >
              <CloseIcon className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          /* Empty State matching Figma */
          <div className="flex flex-col items-center text-center gap-2 sm:gap-2.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#F4F5F8] flex items-center justify-center text-[#18181B] shadow-2xs">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-[#374151]"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-[15px] font-semibold text-[#18181B]">
                Upload{" "}
                <span className="text-[#FF5722] font-bold">{label}</span>
              </span>
              <span className="text-[11px] sm:text-xs text-[#8E8E93] mt-0.5 font-normal">
                Max 10MB
              </span>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <span className="text-xs text-red-500 mt-1 px-2 font-medium">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
