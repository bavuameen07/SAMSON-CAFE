import Link from "next/link";
import { Availability } from "@/components/availability";
import { ProductImage } from "@/components/product-image";
import { RefreshButton } from "@/components/refresh-button";
import { SiteHeader } from "@/components/site-header";
import { buttonClasses } from "@/components/ui/button";
import { loadMenu } from "@/lib/data";
import { formatMoney } from "@/lib/format";

export default async function MenuPage() {
  const { products, settings, error } = await loadMenu();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 pt-[30px] pb-[50px] min-[601px]:px-6 min-[601px]:pt-[46px] min-[601px]:pb-[72px]">
        <section className="mb-[18px] flex items-end justify-between gap-5 max-[600px]:block min-[601px]:mb-[26px]">
          <div>
            <div className="text-[11px] font-bold tracking-[.16em] text-clay uppercase">
              From our kitchen
            </div>
            <h1 className="mt-2 mb-[5px] font-serif text-[34px] font-semibold text-coffee min-[601px]:text-[clamp(32px,5vw,48px)]">
              Something lovely,
              <br /> brewed for you.
            </h1>
            <p className="text-sm text-muted">Your neighborhood pause, made with care.</p>
          </div>
          <div className="pb-1 text-[13px] text-muted max-[600px]:mt-3">
            {products.length} menu {products.length === 1 ? "favorite" : "favorites"}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-[15px] min-[601px]:grid-cols-2 min-[601px]:gap-[22px] min-[851px]:grid-cols-3">
          {error ? (
            <div className="col-span-full rounded-[14px] bg-white p-5 text-center text-muted min-[601px]:p-[72px]">
              <h2 className="font-serif text-coffee">Menu unavailable</h2>
              <p className="mx-auto max-w-[560px]">{error}</p>
              <RefreshButton className="mt-4" />
            </div>
          ) : products.length === 0 ? (
            <div className="col-span-full rounded-[14px] bg-white p-5 text-center text-muted min-[601px]:p-[72px]">
              <h2 className="font-serif text-coffee">A little quiet in the kitchen</h2>
              <p>There are no menu items available right now.</p>
            </div>
          ) : (
            products.map((product, index) => {
              const soldOut = product.stock < 1;
              return (
                <article
                  key={product.id}
                  className="min-w-0 overflow-hidden rounded-[15px] bg-white shadow-card transition duration-200 hover:-translate-y-[3px] hover:shadow-card-hover"
                >
                  <ProductImage
                    picture={product.picture}
                    fallback={settings.fallbackImage}
                    // The first row is above the fold, so load it eagerly as the
                    // page's largest paint and leave the rest lazy.
                    priority={index < 3}
                    sizes="(max-width: 600px) calc(100vw - 32px), (max-width: 850px) calc(50vw - 43px), (max-width: 1050px) calc(33vw - 51px), 378px"
                    className="block h-[218px] w-full bg-[#e9dfd0] object-cover min-[601px]:h-[228px] min-[601px]:max-[1050px]:h-[190px]"
                  />
                  <div className="px-4 pt-4 pb-[17px] min-[601px]:px-[18px] min-[601px]:pt-[18px]">
                    <div className="flex items-start justify-between gap-2.5">
                      <h2 className="font-serif text-[20px] font-semibold text-coffee min-[601px]:text-[21px]">
                        {product.name}
                      </h2>
                      <div className="text-[17px] font-bold whitespace-nowrap text-coffee">
                        {formatMoney(product.price, settings.currency)}
                      </div>
                    </div>
                    <Availability
                      stock={product.stock}
                      threshold={settings.lowStockThreshold}
                    />
                    <Link
                      href={`/order?item=${encodeURIComponent(product.id)}`}
                      aria-disabled={soldOut}
                      className={buttonClasses(
                        "primary",
                        `w-full ${soldOut ? "pointer-events-none opacity-50" : ""}`,
                      )}
                    >
                      BUY NOW
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>
    </>
  );
}
