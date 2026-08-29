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
}

export function Sidebar({ forceCollapsed = false }: SidebarProps) {
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
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
      className={`hidden lg:flex flex-col bg-white rounded-3xl my-3 ml-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#ECEEF2] transition-all duration-300 ease-in-out shrink-0 select-none z-20 ${
        isCollapsed ? "w-[76px] p-3" : "w-[260px] p-4"
      }`}
      style={{ height: "calc(100vh - 24px)" }}
    >
      {/* Header / Logo */}
      <div className="flex items-center justify-between pb-5 pt-1 px-1">
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

      {/* AI Teacher's Toolkit CTA Button */}
      <div className="mb-4">
        {isCollapsed ? (
          <button
            className="w-full h-11 rounded-2xl bg-[#303030] text-[#FF7A50] hover:text-white flex items-center justify-center shadow-sm hover:bg-[#202020] transition-all border border-[#FF7043]/30 group"
            title="AI Teacher's Toolkit"
          >
            <SparklesIcon className="w-5 h-5 text-[#FF7A50] group-hover:scale-110 transition-transform" />
          </button>
        ) : (
          <button className="w-full py-2.5 px-3 rounded-full bg-[#303030] hover:bg-[#202020] text-white flex items-center justify-center gap-2 shadow-sm border border-[#FF7043]/40 transition-all group">
            <SparklesIcon className="w-4 h-4 text-[#FF7A50] group-hover:rotate-12 transition-transform" />
            <span className="text-[13px] font-medium tracking-wide">AI Teacher&apos;s Toolkit</span>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? "bg-[#F3F4F6] text-[#1A1A1A] shadow-xs"
                  : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-gray-50"
              } ${isCollapsed ? "justify-center px-0" : ""}`}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${item.active ? "text-[#1A1A1A]" : "text-[#9CA3AF]"}`} />
              {!isCollapsed && <span>{item.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="pt-3 border-t border-gray-100 flex flex-col gap-3">
        {/* Settings */}
        <button
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#1A1A1A] hover:bg-gray-50 transition-all ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <SettingsIcon className="w-5 h-5 text-[#9CA3AF] shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        {/* DPS School Card */}
        {isCollapsed ? (
          <div className="flex justify-center" title="Delhi Public School, Bokaro Steel City">
            <DPSLogo className="w-9 h-9" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#F8F9FA] border border-[#E9ECEF]">
            <DPSLogo className="w-9 h-9" />
            <div className="flex flex-col text-left overflow-hidden">
              <span className="text-[13px] font-semibold text-[#18181B] truncate leading-tight">
                Delhi Public School
              </span>
              <span className="text-[11px] text-[#71717A] truncate">
                Bokaro Steel City
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
