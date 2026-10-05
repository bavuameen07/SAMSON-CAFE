"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshViewsAction } from "@/app/actions";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";

type RefreshButtonProps = {
  label?: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
};

export function RefreshButton({
  label = "TRY AGAIN",
  pendingLabel = "RETRYING…",
  variant = "primary",
  className,
}: RefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClasses(variant, className)}
      onClick={() =>
        startTransition(async () => {
          await refreshViewsAction();
          router.refresh();
        })
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
