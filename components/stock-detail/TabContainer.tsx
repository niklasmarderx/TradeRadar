"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  tabs: Tab[];
}

export default function TabContainer({ tabs }: Props) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const [mounted, setMounted] = useState<Set<string>>(new Set([tabs[0]?.id ?? ""]));

  function handleTabClick(id: string) {
    setActiveTab(id);
    setMounted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-card-border mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-card-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — lazy mounted, hidden when inactive */}
      {tabs.map((tab) => {
        if (!mounted.has(tab.id)) return null;
        return (
          <div key={tab.id} className={activeTab === tab.id ? "" : "hidden"}>
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
