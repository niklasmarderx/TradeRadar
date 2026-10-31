"use client";

import Link from "next/link";

export default function StockError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <p className="font-mono-num text-4xl font-bold text-down">Fehler</p>
      <p className="text-sm text-sub max-w-md text-center">
        Beim Laden der Aktie ist ein Fehler aufgetreten: {error.message}
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="text-sm text-accent hover:text-bright transition-colors px-4 py-2 rounded border border-card-border"
        >
          Erneut versuchen
        </button>
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors px-4 py-2"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
