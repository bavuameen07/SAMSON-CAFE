"use client";

import Link from "next/link";
import { useActionState } from "react";
import { adminLoginAction } from "@/app/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses, labelClasses } from "@/components/ui/field";
import type { LoginState } from "@/lib/action";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(adminLoginAction, {
    error: null,
  });

  return (
    <main className="grid min-h-screen place-items-center bg-paper p-[22px]">
      <form
        action={formAction}
        className="w-[min(100%,410px)] rounded-[15px] bg-white p-[25px] shadow-card min-[601px]:p-8"
      >
        <Link href="/" className="font-serif text-[21px] font-bold tracking-[.035em] text-coffee">
          SAMSON CAFE
          <small className="mt-0.5 block font-sans text-[10px] font-medium tracking-[.14em] text-clay">
            CAFE MANAGEMENT
          </small>
        </Link>

        <h1 className="mt-[26px] mb-[5px] font-serif text-[29px] font-semibold text-coffee">
          Welcome back
        </h1>
        <p className="mb-6 text-[13px] text-muted">Sign in to manage your cafe.</p>

        {state.error ? (
          <div className="mb-4 rounded-lg bg-[#f8eee9] px-[14px] py-3 text-[13px] text-[#964335]">
            {state.error}
          </div>
        ) : null}

        <div className="mb-[15px] flex flex-col gap-[7px]">
          <label htmlFor="admin-key" className={labelClasses}>
            Admin key
          </label>
          <input
            id="admin-key"
            name="adminKey"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter admin key"
            className={inputClasses}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "mt-1.5 w-full")}
        >
          {pending ? "SIGNING IN…" : "SIGN IN"}
        </button>
      </form>
    </main>
  );
}
