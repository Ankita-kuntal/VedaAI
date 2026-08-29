"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  BackArrowIcon,
  ExamsIcon,
  HelpCircleIcon,
  BellIcon,
  SparkleSingleIcon,
  UserAvatarImage,
  ChevronDownIcon,
  MenuIcon,
} from "./icons";

interface HeaderProps {
  onBackClick?: () => void;
  title?: string;
}

export function Header({ onBackClick, title = "Exams" }: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      router.push("/");
    }
  };

  return (
    <header className="w-full h-14 sm:h-[56px] flex items-center justify-between px-4 lg:px-6 bg-white rounded-2xl sm:rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-[#E5E7EB]/60 shrink-0 select-none">
      {/* Desktop Left: Back Arrow + Exams Breadcrumb */}
      <div className="hidden lg:flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Go back"
        >
          <BackArrowIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <ExamsIcon className="w-4 h-4 text-gray-400" />
          <span>{title}</span>
        </div>
      </div>

      {/* Mobile Left: Back + VedaAI Logo */}
      <div className="flex lg:hidden items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <BackArrowIcon className="w-5 h-5" />
        </button>
        <span className="font-heading font-bold text-lg text-gray-900">VedaAI</span>
      </div>

      {/* Desktop Right Actions */}
      <div className="hidden lg:flex items-center gap-4">
        <button
          className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          title="Help & FAQ"
        >
          <HelpCircleIcon className="w-5 h-5" />
        </button>

        <button
          className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors relative"
          title="Notifications"
        >
          <BellIcon className="w-5 h-5" hasNotification={true} />
        </button>

        <button
          className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          title="AI Insights"
        >
          <SparkleSingleIcon className="w-5 h-5 text-gray-600" />
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 cursor-pointer group">
          <UserAvatarImage className="w-8 h-8" />
          <span className="text-sm font-medium text-gray-800 group-hover:text-black">
            Madhur Rastogi
          </span>
          <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
        </div>
      </div>

      {/* Mobile Right Actions */}
      <div className="flex lg:hidden items-center gap-2.5">
        <button className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 relative">
          <BellIcon className="w-5 h-5" hasNotification={true} />
        </button>
        <UserAvatarImage className="w-8 h-8" />
        <button className="p-2 rounded-xl text-gray-700 hover:bg-gray-100">
          <MenuIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
