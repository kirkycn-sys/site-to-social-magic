import { Phone } from "lucide-react";

export type BrandOverlay = {
  companyName?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
};

export function BrandedVideo({
  src,
  headline,
  brand,
}: {
  src: string;
  headline?: string | null;
  brand: BrandOverlay;
}) {
  const accent = brand.accentColor || "#c8f751";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="aspect-[9/16] w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={`${brand.companyName ?? "Company"} logo`}
            className="h-9 w-9 rounded-lg bg-white/90 object-contain p-1"
          />
        ) : null}
        {brand.companyName ? (
          <span className="font-display text-sm font-semibold text-white drop-shadow">
            {brand.companyName}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/80 to-transparent p-3 pb-12">
        {headline ? (
          <p className="font-display text-lg font-bold leading-tight text-white drop-shadow">
            {headline}
          </p>
        ) : null}
        {brand.phone ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-black"
            style={{ backgroundColor: accent }}
          >
            <Phone className="size-3.5" /> {brand.phone}
          </span>
        ) : null}
      </div>
    </div>
  );
}
