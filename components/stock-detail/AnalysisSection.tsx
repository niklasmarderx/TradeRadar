import { Action } from "@/lib/types";

export default function AnalysisSection({ action }: { action: Action }) {
  return (
    <div className="rounded-lg bg-card border border-card-border p-5">
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-4 section-header">
        Analyse
      </h2>

      <div className="space-y-4 mt-6">
        {action.methodology && (
          <div className="rounded-md bg-secondary/50 border border-border-subtle px-3 py-2">
            <h3 className="text-[10px] text-muted uppercase tracking-wider mb-0.5">
              Methodik
            </h3>
            <p className="text-xs text-accent">{action.methodology}</p>
          </div>
        )}

        <div>
          <h3 className="text-xs text-muted uppercase tracking-wider mb-1">
            These
          </h3>
          <p className="text-sm text-foreground leading-relaxed">
            {action.reason}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs text-muted uppercase tracking-wider mb-1">
              Katalysator
            </h3>
            <p className="text-sm text-accent">{action.catalyst}</p>
          </div>
          <div>
            <h3 className="text-xs text-muted uppercase tracking-wider mb-1">
              Zeitrahmen
            </h3>
            <p className="text-sm text-foreground">{action.timeframe}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {action.sector && (
            <div>
              <h3 className="text-xs text-muted uppercase tracking-wider mb-1">
                Sektor
              </h3>
              <p className="text-sm text-foreground">{action.sector}</p>
            </div>
          )}
          {action.industry && (
            <div>
              <h3 className="text-xs text-muted uppercase tracking-wider mb-1">
                Branche
              </h3>
              <p className="text-sm text-foreground">{action.industry}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
