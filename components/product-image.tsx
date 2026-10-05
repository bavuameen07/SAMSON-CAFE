"use client";

import { useState } from "react";

type ProductImageProps = {
  src: string;
  alt: string;
  fallback: string;
  className?: string;
  priority?: boolean;
};

/**
 * Uses a plain img rather than next/image because item images are arbitrary
 * URLs held in the sheet, so they cannot be declared as remotePatterns.
 */
export function ProductImage({
  src,
  alt,
  fallback,
  className,
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <img
      src={!src || failed ? fallback : src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
