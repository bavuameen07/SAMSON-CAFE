"use client";

import { useCallback, useEffect, useState } from "react";

type ToastTone = "info" | "error";
type ToastState = { message: string; tone: ToastTone } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
  }, []);

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-[22px] left-1/2 z-[60] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg px-[17px] py-3 text-[13px] text-white shadow-card ${
        toast.tone === "error" ? "bg-[#9d3d32]" : "bg-[#2f271f]"
      }`}
    >
      {toast.message}
    </div>
  );
}
