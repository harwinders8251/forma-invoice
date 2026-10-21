"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastData {
  type: "success" | "error" | "info";
  title: string;
  message?: string;
  duration?: number;
}

interface ToastNotificationProps {
  toast: ToastData | null;
  onClose: () => void;
}

export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!toast) return;

    const displayDuration =
      toast.duration ?? (toast.type === "success" ? 3000 : 5000);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, displayDuration);

    const unmountTimer = setTimeout(() => {
      onClose();
      setIsExiting(false);
    }, displayDuration + 320);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, [toast, onClose]);

  const handleManualClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
      setIsExiting(false);
    }, 320);
  };

  if (!toast) return null;

  return (
    <aside
      aria-label="Notification"
      role="status"
      className={`no-print fixed top-5 right-5 z-50 max-w-sm sm:max-w-md w-full bg-white rounded-xl border border-slate-200/90 shadow-2xl p-4 flex items-start gap-3 transition-all duration-300 ease-out transform ${
        isExiting
          ? "opacity-0 -translate-y-3 scale-95 pointer-events-none"
          : "opacity-100 translate-y-0 scale-100"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
          toast.type === "success"
            ? "bg-emerald-100 text-emerald-600"
            : toast.type === "error"
            ? "bg-rose-100 text-rose-600"
            : "bg-indigo-100 text-indigo-600"
        }`}
      >
        {toast.type === "success" ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : toast.type === "error" ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Info className="w-5 h-5" />
        )}
      </div>

      <div className="flex-1 pr-1 min-w-0">
        <h4 className="text-sm font-semibold text-slate-900 leading-snug">
          {toast.title}
        </h4>
        {toast.message && (
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
            {toast.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleManualClose}
        className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors hover:bg-slate-100 flex-shrink-0 cursor-pointer"
        title="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
}
