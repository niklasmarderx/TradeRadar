import Link from "next/link";

export default function StockNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <p className="font-mono-num text-4xl font-bold text-muted">404</p>
      <p className="text-sm text-sub">Ticker nicht gefunden</p>
      <Link
        href="/"
        className="text-sm text-accent hover:text-bright transition-colors"
      >
        Zurueck zum Dashboard
      </Link>
    </div>
  );
}
