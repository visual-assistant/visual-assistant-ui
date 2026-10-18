"use client";

import React from "react";

export type ChantierDetailTab = "CHANTIER" | "SESSION" | "MESSAGES";

type ChantierDetailHeaderTabsProps = {
  activeTab: ChantierDetailTab;
  title?: string;
  subtitle?: string;
  onBack: () => void;
  onTabChange: (tab: ChantierDetailTab) => void;
  rightActions?: React.ReactNode;
};

const TABS: Array<{ key: ChantierDetailTab; label: string }> = [
  { key: "CHANTIER", label: "Info Chantier" },
  { key: "SESSION", label: "Session SAV" },
  { key: "MESSAGES", label: "Messages reçus" },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ChantierDetailHeaderTabs({
  activeTab,
  title = "Chantier Détail",
  subtitle,
  onBack,
  onTabChange,
  rightActions,
}: ChantierDetailHeaderTabsProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-[88px] items-center justify-between gap-4 px-10">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-700 hover:bg-slate-100"
            title="Retour liste chantiers"
          >
            ←
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            {subtitle ? <div className="mt-1 truncate text-sm text-slate-500">{subtitle}</div> : null}
          </div>
        </div>

        {rightActions ? <div className="flex items-center gap-3">{rightActions}</div> : null}
      </div>

      <div className="flex h-12 items-end gap-8 px-10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cx(
              "h-12 border-b-2 px-1 text-sm font-semibold transition",
              activeTab === tab.key
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-slate-700 hover:text-slate-950",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
