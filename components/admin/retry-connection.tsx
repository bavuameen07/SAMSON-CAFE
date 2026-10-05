"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { diagnoseSheetsAction } from "@/app/actions";
import { buttonClasses } from "@/components/ui/button";

/**
 * TRY AGAIN on the admin error page.
 *
 * The failure being retried is normally not in this app: a stale Apps Script
 * deployment only becomes current when somebody redeploys it, so re-rendering
 * would repeat the identical failure. This re-probes the configured web app,
 * reloads the dashboard when the connection answers correctly, and otherwise
 * reports what the deployment is actually serving so the cause stays visible.
 */
export function RetryConnection({ className = "w-full" }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="w-full min-[601px]:w-auto">
      <button
        type="button"
        disabled={pending}
        className={buttonClasses("primary", className)}
        onClick={() =>
          startTransition(async () => {
            const result = await diagnoseSheetsAction();
            if (result.ok) {
              setProblem(null);
              router.refresh();
              return;
            }
            setProblem(result.error);
          })
        }
      >
        {pending ? "CHECKING CONNECTION…" : "TRY AGAIN"}
      </button>
      {problem ? (
        <p className="mt-3 max-w-[560px] text-[12px] leading-relaxed text-[#964335]">{problem}</p>
      ) : null}
    </div>
  );
}