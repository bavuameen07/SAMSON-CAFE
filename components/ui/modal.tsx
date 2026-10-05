"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-[#17110d]/[0.77] p-[18px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-[min(100%,530px)] overflow-auto rounded-[13px] bg-white p-[23px] shadow-[0_25px_90px_#0004]"
      >
        <div className="mb-[18px] flex items-center justify-between gap-4">
          <h2 className="font-serif text-[23px] font-semibold text-coffee">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 shrink-0 cursor-pointer rounded-full border-0 bg-[#f3f0eb] text-[19px] leading-none text-coffee"
          >
            &times;
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-[9px]">{footer}</div> : null}
      </div>
    </div>
  );
}
