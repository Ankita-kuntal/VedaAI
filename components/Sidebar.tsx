"use client";

import React, { useState } from "react";
import {
  VedaAILogo,
  SidebarCollapseIcon,
  SidebarExpandIcon,
  SparklesIcon,
  HomeIcon,
  ClassroomIcon,
  AssignmentsIcon,
  ExamsIcon,
  LibraryIcon,
  SettingsIcon,
  DPSLogo,
} from "./icons";

interface SidebarProps {
  forceCollapsed?: boolean;
  defaultCollapsed?: boolean;
}

export function Sidebar({ forceCollapsed = false, defaultCollapsed = false }: SidebarProps) {
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(defaultCollapsed);
  const isCollapsed = forceCollapsed || isManuallyCollapsed;

  const navItems = [
    { name: "Home", icon: HomeIcon, active: false },
    { name: "My Classroom", icon: ClassroomIcon, active: false },
    { name: "Assignments", icon: AssignmentsIcon, active: false },
    { name: "Exams", icon: ExamsIcon, active: true },
    { name: "My Library", icon: LibraryIcon, active: false },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-[#E5E7EB]/60 transition-all duration-300 ease-in-out shrink-0 select-none z-20 h-full ${
        isCollapsed ? "w-[72px] p-2.5" : "w-[256px] p-4"
      }`}
    >
      {/* Header / Logo */}
      <div className="flex items-center justify-between pb-4 pt-1 px-1">
        <VedaAILogo collapsed={isCollapsed} />
        {!forceCollapsed && (
          <button
            onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <SidebarExpandIcon className="w-4 h-4" />
            ) : (
              <SidebarCollapseIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* AI Teacher's Toolkit CTA Button matching Figma */}
      <div className="mb-4">
        {isCollapsed ? (
          <button
            onClick={() => setIsManuallyCollapsed(false)}
            className="w-full h-11 rounded-2xl bg-[#27272A] text-white hover:text-white flex items-center justify-center shadow-sm hover:bg-[#18181B] transition-all border-2 border-[#FF5722] group cursor-pointer"
            title="AI Teacher's Toolkit"
          >
            <SparklesIcon className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </button>
        ) : (
          <button className="w-full py-2.5 px-3 rounded-full bg-[#27272A] hover:bg-[#18181B] text-white flex items-center justify-center gap-2 shadow-sm border-2 border-[#FF5722] transition-all group cursor-pointer">
            <SparklesIcon className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
            <span className="text-[13px] font-semibold tracking-tight">AI Teacher&apos;s Toolkit</span>
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? "bg-[#F4F4F5] text-[#18181B] font-semibold shadow-2xs"
                  : "text-[#71717A] hover:text-[#18181B] hover:bg-[#FAFAFA]"
              } ${isCollapsed ? "justify-center px-0 py-2.5" : ""}`}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${item.active ? "text-[#18181B]" : "text-[#71717A]"}`} />
              {!isCollapsed && <span>{item.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="pt-2.5 border-t border-[#F4F4F5] flex flex-col gap-2.5">
        {/* Settings */}
        {!isCollapsed && (
          <button
            className="flex items-center gap-3.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[#71717A] hover:text-[#18181B] hover:bg-[#FAFAFA] transition-all"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5 text-[#71717A] shrink-0" />
            <span>Settings</span>
          </button>
        )}

        {/* DPS School Card matching Figma */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex justify-center" title="Delhi Public School, Bokaro Steel City">
              <DPSLogo className="w-9 h-9" />
            </div>
            {!forceCollapsed && (
              <button
                onClick={() => setIsManuallyCollapsed(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Expand sidebar"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#F8F9FA] border border-[#E9ECEF]">
            <DPSLogo className="w-9 h-9" />
            <div className="flex flex-col text-left overflow-hidden">
              <span className="text-[13px] font-bold text-[#18181B] truncate leading-tight">
                Delhi Public School
              </span>
              <span className="text-[11px] text-[#71717A] truncate mt-0.5">
                Bokaro Steel City
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
