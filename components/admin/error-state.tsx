import { adminLogoutAction } from "@/app/actions";
import { RetryConnection } from "@/components/admin/retry-connection";
import { buttonClasses } from "@/components/ui/button";

export function AdminErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-[14px] bg-white p-5 text-center text-muted min-[601px]:p-[72px]">
      <h2 className="font-serif text-coffee">Google Sheets unavailable</h2>
      <p className="mx-auto mt-2 max-w-[560px] leading-relaxed">{message}</p>
      <div className="mt-5 flex flex-col-reverse items-center justify-center gap-3 min-[601px]:flex-row">
        <form action={adminLogoutAction} className="w-full min-[601px]:w-auto">
          <button type="submit" className={buttonClasses("secondary", "w-full")}>
            SIGN OUT
          </button>
        </form>
        <RetryConnection />
      </div>
    </section>
  );
}
