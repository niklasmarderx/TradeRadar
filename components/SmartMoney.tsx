"use client";

import { useState } from "react";
import CongressPanel from "@/components/smart-money/CongressPanel";
import WhalePanel from "@/components/smart-money/WhalePanel";
import InsiderPanel from "@/components/smart-money/InsiderPanel";
import type { CongressTrade } from "@/lib/api/smart-money-types";

const TABS = [
  { id: "congress", label: "Politiker" },
  { id: "whales", label: "Whale Portfolios" },
  { id: "insider", label: "Insider" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SmartMoneyProps {
  initialCongress: CongressTrade[];
}

export default function SmartMoney({ initialCongress }: SmartMoneyProps) {
  const [activeTab, setActiveTab] = useState<TabId>("congress");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-card-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "congress" && <CongressPanel trades={initialCongress} />}
      {activeTab === "whales" && <WhalePanel />}
      {activeTab === "insider" && <InsiderPanel />}
    </div>
  );
}
