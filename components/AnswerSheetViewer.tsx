"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ZoomInIcon,
  ZoomOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UploadCloudIcon,
} from "./icons";
import { AnswerRegion } from "@/context/AppContext";

// Dynamically import react-pdf components to prevent SSR DOMMatrix issues
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);

const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

// Helper to compute clean, generously padded bounding box styles with a comfortable min-height
// and neighbor midpoint clamping so adjacent lines (e.g. 11a and 11b) never overlap or bleed into each other
function computePaddedBoxStyle(
  bbox: [number, number, number, number],
  allRegions?: AnswerRegion[],
  pageNumber: number = 1
) {
  const [ymin, xmin, ymax, xmax] = bbox;
  const rawTop = ymin / 10;
  const rawLeft = xmin / 10;
  const rawH = (ymax - ymin) / 10;
  const rawW = (xmax - xmin) / 10;
  const thisBottom = rawTop + rawH;

  // 1. Horizontal padding is generous (~1.6% / ~12-16px) to cleanly frame line starts and ends
  const horizontalPadding = 1.6;
  const left = Math.max(0, rawLeft - horizontalPadding);
  const width = Math.min(100 - left, rawW + horizontalPadding * 2);

  // 2. Base vertical padding: small and clean (~0.45% / ~4-5px)
  const baseVerticalPadding = 0.45;
  const targetMinHeight = 3.6; // ~28-34px comfortable line height

  // 3. Find closest neighbor line above and below on the same page
  let maxTopBound = 0;
  let minBottomBound = 100;

  if (allRegions && allRegions.length > 0) {
    for (const other of allRegions) {
      const otherPage = other.page || 1;
      if (otherPage !== pageNumber) continue;

      const [oYmin, , oYmax] = other.bbox;
      if (oYmin === ymin && oYmax === ymax) continue;

      const oTop = oYmin / 10;
      const oBottom = oYmax / 10;

      // Neighbor above
      if (oBottom <= rawTop) {
        const midpoint = (oBottom + rawTop) / 2;
        if (midpoint > maxTopBound) {
          maxTopBound = midpoint;
        }
      }

      // Neighbor below (e.g. 11b is below 11a)
      if (oTop >= thisBottom) {
        const midpoint = (thisBottom + oTop) / 2;
        if (midpoint < minBottomBound) {
          minBottomBound = midpoint;
        }
      }
    }
  }

  // Desired top and bottom with vertical padding
  let desiredTop = rawTop - baseVerticalPadding;
  let desiredBottom = thisBottom + baseVerticalPadding;

  // Expand if less than min height
  if (desiredBottom - desiredTop < targetMinHeight) {
    const deficit = targetMinHeight - (desiredBottom - desiredTop);
    desiredTop -= deficit / 2;
    desiredBottom += deficit / 2;
  }

  // Clamp to neighbor midpoints so we never touch or bleed into adjacent lines
  if (desiredTop < maxTopBound) {
    desiredTop = maxTopBound + 0.1;
  }
  if (desiredBottom > minBottomBound) {
    desiredBottom = minBottomBound - 0.1;
  }

  // Fallback sanity check
  if (desiredBottom <= desiredTop) {
    desiredTop = rawTop;
    desiredBottom = thisBottom;
  }

  const height = Math.max(1, desiredBottom - desiredTop);
  const top = Math.max(0, desiredTop);

  return {
    top: `${top.toFixed(2)}%`,
    left: `${left.toFixed(2)}%`,
    height: `${height.toFixed(2)}%`,
    width: `${width.toFixed(2)}%`,
    raw: { top: rawTop, left: rawLeft, height: rawH, width: rawW },
    padded: { top, left, height, width },
  };
}

interface AnswerSheetViewerProps {
  file: File | null;
  activeRegion: AnswerRegion | null;
  activeQuestionNumber: string | null;
  unmatchedRegion?: AnswerRegion | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages?: number;
  allRegions?: AnswerRegion[];
}

export function AnswerSheetViewer({
  file,
  activeRegion,
  activeQuestionNumber,
  unmatchedRegion,
  currentPage,
  onPageChange,
  totalPages = 1,
  allRegions = [],
}: AnswerSheetViewerProps) {
  const router = useRouter();
  const [zoom, setZoom] = useState<number>(100);
  const [numPages, setNumPages] = useState<number>(totalPages);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [isImage, setIsImage] = useState<boolean>(false);
  const [pdfWorkerReady, setPdfWorkerReady] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(640);
  const [imageDimensions, setImageDimensions] = useState<{
    naturalWidth: number;
    naturalHeight: number;
    displayedWidth: number;
    displayedHeight: number;
  } | null>(null);

  // Compute rendered width: 100% zoom fits the container width cleanly (fit-to-width)
  const renderedWidth = Math.max(
    320,
    Math.round(containerWidth * (zoom / 100))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeOverlayRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Measure container width for responsive fit-to-width
  useEffect(() => {
    if (!containerRef.current) return;

    const measureWidth = () => {
      if (containerRef.current) {
        // Leave comfortable horizontal padding (e.g. 24px each side = 48px total)
        const available = containerRef.current.clientWidth - 48;
        if (available > 200) {
          setContainerWidth(available);
        }
      }
    };

    measureWidth();
    const observer = new ResizeObserver(measureWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update and track image element rendered dimensions
  const updateImageDimensions = useCallback(() => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    const dims = {
      naturalWidth: img.naturalWidth || 0,
      naturalHeight: img.naturalHeight || 0,
      displayedWidth: img.clientWidth || img.offsetWidth || 0,
      displayedHeight: img.clientHeight || img.offsetHeight || 0,
    };
    if (dims.naturalWidth > 0 && dims.displayedWidth > 0) {
      setImageDimensions(dims);
    }
    return dims;
  }, []);

  // Observe image resize events (e.g. when zooming or resizing browser window)
  useEffect(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const observer = new ResizeObserver(() => {
      updateImageDimensions();
    });
    observer.observe(img);
    return () => observer.disconnect();
  }, [isImage, fileUrl, updateImageDimensions]);

  // Comprehensive diagnostic coordinate math logging for images & PDFs
  useEffect(() => {
    const region = activeRegion || unmatchedRegion;
    if (!region) return;

    const [ymin, xmin, ymax, xmax] = region.bbox;
    const pageNum = region.page || 1;
    const paddedBox = computePaddedBoxStyle(region.bbox, allRegions, pageNum);

    if (isImage && imageRef.current) {
      const img = imageRef.current;
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const displayedW = img.clientWidth || img.offsetWidth;
      const displayedH = img.clientHeight || img.offsetHeight;

      const pixelTop = (paddedBox.padded.top / 100) * displayedH;
      const pixelLeft = (paddedBox.padded.left / 100) * displayedW;
      const pixelWidth = (paddedBox.padded.width / 100) * displayedW;
      const pixelHeight = (paddedBox.padded.height / 100) * displayedH;

      console.log("📐 [AnswerSheetViewer - Image Coordinate Scaling]", {
        target: activeQuestionNumber ? `Q${activeQuestionNumber}` : "Unmatched",
        imageNaturalDimensions: `${naturalW}px × ${naturalH}px`,
        imageDisplayedDimensions: `${displayedW}px × ${displayedH}px`,
        rawGeminiBbox: `[ymin: ${ymin}, xmin: ${xmin}, ymax: ${ymax}, xmax: ${xmax}]`,
        rawPercentages: {
          top: `${paddedBox.raw.top.toFixed(2)}%`,
          left: `${paddedBox.raw.left.toFixed(2)}%`,
          width: `${paddedBox.raw.width.toFixed(2)}%`,
          height: `${paddedBox.raw.height.toFixed(2)}%`,
        },
        paddedDisplayPercentages: {
          top: paddedBox.top,
          left: paddedBox.left,
          width: paddedBox.width,
          height: paddedBox.height,
        },
        finalCalculatedPixels: {
          top: `${pixelTop.toFixed(2)}px`,
          left: `${pixelLeft.toFixed(2)}px`,
          width: `${pixelWidth.toFixed(2)}px`,
          height: `${pixelHeight.toFixed(2)}px`,
        },
        zoomLevel: `${zoom}%`,
      });
    } else if (isPdf) {
      const targetPageEl = pageRefs.current[pageNum];
      if (targetPageEl) {
        const displayedW = targetPageEl.clientWidth;
        const displayedH = targetPageEl.clientHeight;

        const pixelTop = (paddedBox.padded.top / 100) * displayedH;
        const pixelLeft = (paddedBox.padded.left / 100) * displayedW;
        const pixelWidth = (paddedBox.padded.width / 100) * displayedW;
        const pixelHeight = (paddedBox.padded.height / 100) * displayedH;

        console.log("📄 [AnswerSheetViewer - PDF Coordinate Scaling]", {
          target: activeQuestionNumber ? `Q${activeQuestionNumber}` : "Unmatched",
          pageNum,
          pageRenderedDimensions: `${displayedW}px × ${displayedH}px`,
          rawGeminiBbox: `[ymin: ${ymin}, xmin: ${xmin}, ymax: ${ymax}, xmax: ${xmax}]`,
          paddedDisplayPercentages: {
            top: paddedBox.top,
            left: paddedBox.left,
            width: paddedBox.width,
            height: paddedBox.height,
          },
          finalCalculatedPixels: {
            top: `${pixelTop.toFixed(2)}px`,
            left: `${pixelLeft.toFixed(2)}px`,
            width: `${pixelWidth.toFixed(2)}px`,
            height: `${pixelHeight.toFixed(2)}px`,
          },
          zoomLevel: `${zoom}%`,
        });
      }
    }
  }, [
    activeRegion,
    unmatchedRegion,
    activeQuestionNumber,
    isImage,
    isPdf,
    renderedWidth,
    zoom,
    allRegions,
  ]);

  // Initialize PDF.js worker
  useEffect(() => {
    import("react-pdf")
      .then((pdfModule) => {
        pdfModule.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        setPdfWorkerReady(true);
      })
      .catch((err) => {
        console.warn("Failed to load local PDF worker, falling back to CDN:", err);
        import("react-pdf").then((pdfModule) => {
          pdfModule.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfModule.pdfjs.version}/build/pdf.worker.min.mjs`;
          setPdfWorkerReady(true);
        });
      });
  }, []);

  // Create and manage object URL for the uploaded binary file
  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      setIsPdf(false);
      setIsImage(false);
      return;
    }

    setLoadError(null);
    const url = URL.createObjectURL(file);
    setFileUrl(url);

    const type = (file.type || "").toLowerCase();
    const name = file.name.toLowerCase();

    if (type.includes("pdf") || name.endsWith(".pdf")) {
      setIsPdf(true);
      setIsImage(false);
    } else {
      setIsImage(true);
      setIsPdf(false);
      setNumPages(1);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Precise smooth scroll calculation to center the highlighted region vertically in the viewport
  const centerHighlightRegion = useCallback((region: AnswerRegion | null) => {
    if (!region || !containerRef.current) return;

    const targetPageNum = region.page || 1;
    const targetPageEl = pageRefs.current[targetPageNum];
    if (!targetPageEl) return;

    const container = containerRef.current;
    const pageTop = targetPageEl.offsetTop;
    const pageHeight = targetPageEl.offsetHeight || targetPageEl.clientHeight;

    // Calculate vertical center of the bounding box on the page
    const ymin = region.bbox[0]; // 0-1000
    const ymax = region.bbox[2]; // 0-1000
    const normalizedCenterY = (ymin + ymax) / 2000;
    const bboxAbsoluteCenterY = pageTop + normalizedCenterY * pageHeight;

    const containerHeight = container.clientHeight;
    const targetScrollTop = bboxAbsoluteCenterY - containerHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: "smooth",
    });
  }, []);

  // Auto-scroll when active region or unmatched region changes
  useEffect(() => {
    const targetRegion = activeRegion || unmatchedRegion;
    if (targetRegion) {
      const targetPageNum = targetRegion.page || 1;
      onPageChange(targetPageNum);

      // Perform initial smooth scroll, and a follow-up after layout settles
      centerHighlightRegion(targetRegion);
      const timer1 = setTimeout(() => centerHighlightRegion(targetRegion), 100);
      const timer2 = setTimeout(() => centerHighlightRegion(targetRegion), 300);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [activeRegion, unmatchedRegion, centerHighlightRegion, onPageChange]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 75));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1;
      onPageChange(nextP);
      const targetEl = pageRefs.current[nextP];
      if (targetEl && containerRef.current) {
        containerRef.current.scrollTo({
          top: targetEl.offsetTop,
          behavior: "smooth",
        });
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const nextP = currentPage + 1;
      onPageChange(nextP);
      const targetEl = pageRefs.current[nextP];
      if (targetEl && containerRef.current) {
        containerRef.current.scrollTo({
          top: targetEl.offsetTop,
          behavior: "smooth",
        });
      }
    }
  };

  const onDocumentLoadSuccess = ({ numPages: loadedNumPages }: { numPages: number }) => {
    setNumPages(loadedNumPages);
    setLoadError(null);
    if (activeRegion) {
      setTimeout(() => centerHighlightRegion(activeRegion), 200);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading uploaded PDF file:", error);
    setLoadError(`Failed to load uploaded PDF: ${error.message}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#303030] rounded-3xl overflow-hidden shadow-sm border border-[#27272A]">
      {/* Top Header Bar matching Figma */}
      <div className="h-14 px-4 sm:px-6 bg-[#262626] border-b border-[#3F3F46] flex items-center justify-between shrink-0 select-none">
        {/* Left: Title & Uploaded File Name */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-white font-heading font-semibold text-sm sm:text-base tracking-tight shrink-0">
            Answer Sheet
          </span>
          {file && (
            <span className="text-xs text-gray-400 font-mono truncate max-w-[140px] sm:max-w-[240px]">
              ({file.name})
            </span>
          )}
        </div>

        {/* Right: Zoom Controls & Page Navigation */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* Zoom Control Pill */}
          <div className="flex items-center bg-[#3F3F46] hover:bg-[#4B4B52] transition-colors rounded-xl p-1 text-white text-xs font-medium shadow-xs">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 75}
              title="Zoom out"
              className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ZoomOutIcon className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] min-w-[40px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              title="Zoom in"
              className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ZoomInIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page Navigation Pill */}
          <div className="flex items-center bg-[#3F3F46] hover:bg-[#4B4B52] transition-colors rounded-xl p-1 text-white text-xs font-medium shadow-xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              title="Previous page"
              className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] min-w-[70px] text-center font-medium">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              title="Next page"
              className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Answer Sheet Scrollable Container with Smooth Scrolling */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 flex flex-col items-center gap-6 bg-[#212124] scroll-smooth"
      >
        {/* State 1: No file uploaded */}
        {!file && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 my-auto">
            <UploadCloudIcon className="w-12 h-12 text-gray-500 mb-3" />
            <p className="text-sm font-semibold text-gray-200">
              No Answer Sheet Uploaded
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Please upload your student answer sheet PDF or image on the upload page to view mapped answers and highlights.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 px-5 py-2.5 bg-[#FF5722] hover:bg-[#E64A19] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-98"
            >
              Go to Upload
            </button>
          </div>
        )}

        {/* State 2: Load error */}
        {loadError && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 p-4 rounded-2xl text-xs max-w-md text-center">
            <p className="font-bold mb-1">Failed to render answer sheet</p>
            <p className="text-red-300">{loadError}</p>
          </div>
        )}

        {/* State 3: Uploaded Image rendering */}
        {isImage && fileUrl && (
          <div
            ref={(el) => {
              pageRefs.current[1] = el;
            }}
            style={{
              width: `${renderedWidth}px`,
              maxWidth: "100%",
              transition: "width 0.2s ease-out",
            }}
            className="relative bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-300 select-none flex flex-col items-center justify-center"
          >
            {/* Direct Image Container with Exact 1:1 Overlay Anchor */}
            <div className="relative w-full h-auto block">
              <img
                ref={imageRef}
                src={fileUrl}
                alt="Uploaded Student Answer Sheet"
                onLoad={updateImageDimensions}
                className="w-full h-auto block select-none pointer-events-none"
              />

              {/* Matched Bounding Box Overlay on Real Image */}
              {activeRegion && (activeRegion.page === 1 || !activeRegion.page) && (
                (() => {
                  const boxStyle = computePaddedBoxStyle(
                    activeRegion.bbox,
                    allRegions,
                    1
                  );
                  return (
                    <div
                      ref={activeOverlayRef}
                      style={{
                        top: boxStyle.top,
                        left: boxStyle.left,
                        height: boxStyle.height,
                        width: boxStyle.width,
                      }}
                      className="absolute border-2 border-[#16A34A] bg-[#22C55E]/15 rounded-xl pointer-events-none transition-all duration-300 ease-out shadow-[0_0_20px_rgba(34,197,94,0.35)] animate-pulse-subtle z-20"
                    >
                      <div className="absolute -top-4 -left-0.5 bg-[#16A34A] text-white text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-t-md rounded-br-md shadow-sm flex items-center gap-1">
                        <span>Q{activeQuestionNumber || "1"}</span>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Unmatched Bounding Box Overlay on Real Image */}
              {unmatchedRegion && (unmatchedRegion.page === 1 || !unmatchedRegion.page) && (
                (() => {
                  const boxStyle = computePaddedBoxStyle(
                    unmatchedRegion.bbox,
                    allRegions,
                    1
                  );
                  return (
                    <div
                      style={{
                        top: boxStyle.top,
                        left: boxStyle.left,
                        height: boxStyle.height,
                        width: boxStyle.width,
                      }}
                      className="absolute border-2 border-amber-500 bg-amber-500/20 rounded-xl pointer-events-none transition-all duration-300 ease-out shadow-[0_0_20px_rgba(245,158,11,0.35)] z-20"
                    >
                      <div className="absolute -top-4 -left-0.5 bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-t-md rounded-br-md shadow-sm">
                        <span>Unmatched</span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* State 4: Uploaded PDF rendering using react-pdf */}
        {isPdf && fileUrl && pdfWorkerReady && (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                <div className="w-8 h-8 border-3 border-[#FF5722] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-gray-300 font-medium">
                  Loading answer sheet PDF...
                </p>
              </div>
            }
            className="flex flex-col items-center gap-6 w-full"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
              const isCurrentRegionPage = activeRegion?.page === pageNum;
              const isUnmatchedPage = unmatchedRegion?.page === pageNum;

              return (
                <div
                  key={pageNum}
                  ref={(el) => {
                    pageRefs.current[pageNum] = el;
                  }}
                  style={{
                    width: `${renderedWidth}px`,
                    maxWidth: "100%",
                    transition: "width 0.2s ease-out",
                  }}
                  className="relative bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-300 select-none flex flex-col"
                >
                  {/* Page subtle tag */}
                  <div className="absolute top-2 right-4 text-[10px] font-mono text-gray-400 select-none pointer-events-none z-10 bg-white/80 px-1.5 py-0.5 rounded shadow-xs">
                    Page {pageNum}
                  </div>

                  {/* Real Rendered PDF Page Canvas */}
                  <Page
                    pageNumber={pageNum}
                    width={renderedWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="block w-full h-auto"
                  />

                  {/* Dynamic Bounding Box Overlay for Matched Active Question on Real PDF Page */}
                  {isCurrentRegionPage && activeRegion && (
                    (() => {
                      const boxStyle = computePaddedBoxStyle(
                        activeRegion.bbox,
                        allRegions,
                        pageNum
                      );
                      return (
                        <div
                          ref={activeOverlayRef}
                          style={{
                            top: boxStyle.top,
                            left: boxStyle.left,
                            height: boxStyle.height,
                            width: boxStyle.width,
                          }}
                          className="absolute border-2 border-[#16A34A] bg-[#22C55E]/15 rounded-xl pointer-events-none transition-all duration-300 ease-out shadow-[0_0_20px_rgba(34,197,94,0.35)] animate-pulse-subtle z-20"
                        >
                          {/* Top-Left Green Pill Badge Q{Number} matching Figma */}
                          <div className="absolute -top-4 -left-0.5 bg-[#16A34A] text-white text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-t-md rounded-br-md shadow-sm flex items-center gap-1">
                            <span>Q{activeQuestionNumber || "1"}</span>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Dynamic Bounding Box Overlay for Unmatched Handwriting on Real PDF Page */}
                  {isUnmatchedPage && unmatchedRegion && (
                    (() => {
                      const boxStyle = computePaddedBoxStyle(
                        unmatchedRegion.bbox,
                        allRegions,
                        pageNum
                      );
                      return (
                        <div
                          style={{
                            top: boxStyle.top,
                            left: boxStyle.left,
                            height: boxStyle.height,
                            width: boxStyle.width,
                          }}
                          className="absolute border-2 border-amber-500 bg-amber-500/20 rounded-xl pointer-events-none transition-all duration-300 ease-out shadow-[0_0_20px_rgba(245,158,11,0.35)] z-20"
                        >
                          <div className="absolute -top-4 -left-0.5 bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-t-md rounded-br-md shadow-sm">
                            <span>Unmatched</span>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </Document>
        )}
      </div>
    </div>
  );
}
