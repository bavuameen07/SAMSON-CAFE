"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductPicture } from "@/lib/types";

type ProductImageProps = {
  /** The picture resolved from the product name, or `null` to use the fallback. */
  picture: ProductPicture | null;
  /** Always-available image used when there is no picture, or one fails to load. */
  fallback: string;
  /** Overrides the picture's generated alt text. Pass `""` for decorative thumbs. */
  alt?: string;
  className?: string;
  priority?: boolean;
  /** Layout width of the image, so the browser can pick a source. */
  sizes?: string;
};

/**
 * Renders a resolved product picture.
 *
 * Local assets are served through next/image, which gives responsive `srcset`
 * candidates, automatic modern-format delivery, lazy loading by default and a
 * reserved aspect ratio so nothing shifts while the photo arrives. Anything
 * else — a URL typed into the Items sheet, or a generated URL — is rendered as a
 * plain `img`, because arbitrary hosts cannot be declared as `remotePatterns`.
 *
 * If a picture fails to load the cafe fallback is shown, so a broken image icon
 * never reaches the page.
 */
export function ProductImage({
  picture,
  fallback,
  alt,
  className,
  priority = false,
  sizes,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const picture$ = picture && !failed ? picture : null;
  const label = alt ?? picture?.alt ?? "";

  if (!picture$) {
    return (
      <img
        src={fallback}
        alt={label}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    );
  }

  if (picture$.local) {
    return (
      <Image
        src={picture$.url}
        alt={label}
        width={picture$.width || undefined}
        height={picture$.height || undefined}
        sizes={sizes ?? (picture$.srcSet ? "100vw" : undefined)}
        priority={priority}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <img
      src={picture$.url}
      srcSet={picture$.srcSet}
      sizes={picture$.srcSet ? (sizes ?? "100vw") : undefined}
      alt={label}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
