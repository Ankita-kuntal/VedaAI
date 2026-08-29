"use client";

import React from "react";
import { AnimatedSparkleGroup } from "./icons";

interface LoadingStateProps {
  stage: "uploading" | "extracting";
}

export function LoadingState({ stage }: LoadingStateProps) {
  const isUploading = stage === "uploading";

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-12 px-6 animate-fadeIn">
      {/* Animated Sparkle Stars */}
      <div className="mb-6 relative flex items-center justify-center">
        <AnimatedSparkleGroup className="w-32 h-32 lg:w-40 lg:h-40" />
      </div>

      {/* Main Status Heading */}
      <h2 className="font-heading text-2xl lg:text-3xl font-bold text-[#18181B] tracking-tight text-center">
        {isUploading ? "Uploading..." : "Extracting..."}
      </h2>

      {/* Subtitle */}
      <p className="text-sm lg:text-base text-[#71717A] mt-2 text-center font-normal">
        This may take a while
      </p>

      {/* Staged Progress Indicator Pill */}
      <div className="mt-8 flex items-center gap-2 bg-[#F4F5F8] px-4 py-2 rounded-full border border-[#E5E7EB] text-xs font-medium">
        <span
          className={`flex items-center gap-1.5 ${
            isUploading ? "text-[#FF5722] font-semibold" : "text-[#10B981]"
          }`}
        >
          {isUploading ? (
            <span className="w-2 h-2 rounded-full bg-[#FF5722] animate-ping" />
          ) : (
            <svg
              className="w-3.5 h-3.5"
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
          1. Uploading
        </span>

        <span className="text-gray-300">→</span>

        <span
          className={`flex items-center gap-1.5 ${
            !isUploading ? "text-[#FF5722] font-semibold" : "text-gray-400"
          }`}
        >
          {!isUploading && (
            <span className="w-2 h-2 rounded-full bg-[#FF5722] animate-ping" />
          )}
          2. Extracting Questions
        </span>
      </div>
    </div>
  );
}
