import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderFlow } from "@/components/order/order-flow";
import { RefreshButton } from "@/components/refresh-button";
import { SiteHeader } from "@/components/site-header";
import { buttonClasses } from "@/components/ui/button";
import { loadMenu } from "@/lib/data";

export const metadata: Metadata = {
  title: "Your order",
};

type OrderPageProps = {
  searchParams: Promise<{ item?: string | string[] }>;
};

function notice(title: string, detail: string, retry: boolean) {
  return (
    <main className="mx-auto max-w-[960px] px-[15px] pt-[22px] pb-[48px] min-[601px]:px-6 min-[601px]:pt-[34px] min-[601px]:pb-[76px]">
      <section className="rounded-[16px] bg-white p-[17px] text-center shadow-card min-[601px]:p-[40px]">
        <h1 className="mb-2 font-serif text-[25px] font-semibold text-coffee min-[601px]:text-[29px]">
          {title}
        </h1>
        <p className="mx-auto max-w-[520px] text-[13px] text-muted">{detail}</p>
        <div className="mt-5 flex flex-col-reverse justify-center gap-3 min-[601px]:flex-row">
          <Link href="/" className={buttonClasses("secondary", "w-full min-[601px]:w-auto")}>
            BACK TO MENU
          </Link>
          {retry ? <RefreshButton className="w-full min-[601px]:w-auto" /> : null}
        </div>
      </section>
    </main>
  );
}

export default async function OrderPage({ searchParams }: OrderPageProps) {
  const params = await searchParams;
  const requested = Array.isArray(params.item) ? params.item[0] : params.item;
  const itemId = (requested ?? "").trim();

  if (!itemId) redirect("/");

  const { products, settings, error } = await loadMenu();

  if (error) {
    return (
      <>
        <SiteHeader />
        {notice("Menu unavailable", error, true)}
      </>
    );
  }

  const product = products.find((candidate) => candidate.id === itemId) ?? null;

  if (!product) {
    return (
      <>
        <SiteHeader />
        {notice(
          "This item is no longer on the menu",
          "It may have been removed or hidden by the cafe. Head back to the menu to see what is available today.",
          false,
        )}
      </>
    );
  }

  if (product.stock < 1) {
    return (
      <>
        <SiteHeader />
        {notice(
          "Sorry, this item just sold out",
          "Stock was taken while you were deciding. Have another look at the rest of the menu.",
          false,
        )}
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <OrderFlow product={product} settings={settings} />
    </>
  );
}
