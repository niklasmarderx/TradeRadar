"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

interface Toast {
  id: number;
  title: string;
  body: string;
  type: "success" | "warning" | "info";
  url?: string;
  createdAt: number;
}

interface NotificationContextType {
  toasts: Toast[];
  notify: (title: string, body: string, opts?: { type?: Toast["type"]; url?: string }) => void;
  dismissToast: (id: number) => void;
  permissionGranted: boolean;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const idRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, body: string, opts?: { type?: Toast["type"]; url?: string }) => {
      const id = ++idRef.current;
      const toast: Toast = {
        id,
        title,
        body,
        type: opts?.type ?? "info",
        url: opts?.url,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev.slice(-9), toast]); // max 10

      // Auto-dismiss after 8 seconds
      setTimeout(() => dismissToast(id), 8000);

      // Browser notification
      if (permissionGranted && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const n = new Notification(title, { body, icon: "/favicon.ico" });
          if (opts?.url) {
            n.onclick = () => { window.focus(); window.location.href = opts.url!; };
          }
        } catch {
          // Notification API may fail silently
        }
      }
    },
    [permissionGranted, dismissToast]
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermissionGranted(result === "granted");
  }, []);

  return (
    <NotificationContext value={{ toasts, notify, dismissToast, permissionGranted, requestPermission }}>
      {children}
    </NotificationContext>
  );
}
