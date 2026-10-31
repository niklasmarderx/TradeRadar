"use client";

import { useEffect } from "react";
import { useNotifications } from "@/components/NotificationProvider";

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  // Handle click navigation
  const handleClick = (url?: string) => {
    if (url) window.location.href = url;
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} onClick={handleClick} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
  onClick,
}: {
  toast: { id: number; title: string; body: string; type: string; url?: string; createdAt: number };
  onDismiss: (id: number) => void;
  onClick: (url?: string) => void;
}) {
  const borderColor =
    toast.type === "success" ? "border-up/50" : toast.type === "warning" ? "border-gold/50" : "border-accent/50";
  const iconColor =
    toast.type === "success" ? "text-up" : toast.type === "warning" ? "text-gold" : "text-accent";

  // Slide-in animation via useEffect
  useEffect(() => {
    const el = document.getElementById(`toast-${toast.id}`);
    if (el) {
      el.style.opacity = "0";
      el.style.transform = "translateX(100%)";
      requestAnimationFrame(() => {
        el.style.transition = "all 300ms ease-out";
        el.style.opacity = "1";
        el.style.transform = "translateX(0)";
      });
    }
  }, [toast.id]);

  return (
    <div
      id={`toast-${toast.id}`}
      className={`bg-card border ${borderColor} rounded-lg p-3 shadow-lg cursor-pointer hover:bg-card-hover transition-colors`}
      onClick={() => onClick(toast.url)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`${iconColor} mt-0.5 shrink-0`}>
            {toast.type === "success" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : toast.type === "warning" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-bright truncate">{toast.title}</p>
            <p className="text-[10px] text-sub mt-0.5 line-clamp-2">{toast.body}</p>
            <p className="text-[9px] text-muted mt-1">
              {new Date(toast.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
          className="text-muted hover:text-foreground shrink-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
