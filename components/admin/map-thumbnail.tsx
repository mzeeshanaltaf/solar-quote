"use client";

import { useState } from "react";
import { MapPinIcon } from "lucide-react";

interface MapThumbnailProps {
  lat: number;
  lng: number;
  label?: string | null;
}

// Google Static Maps thumbnail of the confirmed roof pin. Uses the browser
// (HTTP-referrer-restricted) key — the same one the funnel's interactive map
// uses — so no server key is exposed. Falls back to a coordinate chip if the
// key is absent or the image fails (e.g. Static Maps API not enabled).
export function MapThumbnail({ lat, lng, label }: MapThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  if (!key || failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 py-10 text-center">
        <MapPinIcon className="size-6 text-primary" />
        <p className="text-sm font-medium">{label || "Roof location"}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{coords}</p>
      </div>
    );
  }

  const src =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=19&size=640x320&scale=2&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}&key=${key}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Satellite view of ${label || "the roof"}`}
        width={1280}
        height={640}
        loading="lazy"
        decoding="async"
        className="aspect-2/1 w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
