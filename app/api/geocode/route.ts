import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";

// Phase 3.1 — Location. The unrestricted Google Geocoding key never reaches the
// browser: the client posts a sessionId (or a free-text search override) here,
// we geocode server-side, and return candidates. A separate PATCH persists the
// pin the user confirms on the map. Mirrors /api/extract's POST-computes /
// PATCH-persists split.

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  no_address: 422,
  no_results: 422,
  rate: 429,
  geocode_failed: 502,
  not_configured: 500,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that session. Please start over.",
  no_address:
    "We don't have an address for this bill yet. Search for your address to drop a pin.",
  no_results:
    "We couldn't find that address. Try a more complete address, or drag the pin to your roof.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  geocode_failed:
    "We couldn't reach the map service. Search again, or drag the pin to your roof.",
  not_configured: "Mapping isn't configured. Please try again later.",
  server: "Something went wrong. Please try again.",
};

function fail(code: string, message?: string) {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: message ?? ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server,
    },
    { status: ERROR_STATUS[code] ?? 500 }
  );
}

type Confidence = "high" | "medium" | "low";

interface Candidate {
  formattedAddress: string;
  lat: number;
  lng: number;
  locationType: string;
  partialMatch: boolean;
  confidence: Confidence;
}

// Google's location_type tells us how precise the match is. ROOFTOP is a real
// address; the others get progressively coarser. partial_match drops it a notch.
function confidenceFor(locationType: string, partialMatch: boolean): Confidence {
  let base: Confidence;
  switch (locationType) {
    case "ROOFTOP":
      base = "high";
      break;
    case "RANGE_INTERPOLATED":
    case "GEOMETRIC_CENTER":
      base = "medium";
      break;
    default:
      base = "low";
  }
  if (partialMatch && base === "high") return "medium";
  if (partialMatch && base === "medium") return "low";
  return base;
}

// Build the best free-text query we can from everything extraction gave us. We
// lead with the printed street line (it's what earns ROOFTOP precision) and then
// append the coarse components — town, city, state, country — so a bare street
// like "House 12, Street 4" still resolves to the right city/country. Components
// already contained in an earlier part are skipped so we don't repeat "Lahore,
// Lahore". When nothing usable is present, return null and the UI shows search.
function buildQuery(session: {
  rawAddress: string | null;
  addressTown: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressCountry: string | null;
}): string | null {
  const parts = [
    session.rawAddress,
    session.addressTown,
    session.addressCity,
    session.addressState,
    session.addressCountry,
  ];
  const collected: string[] = [];
  for (const raw of parts) {
    const part = raw?.trim();
    if (!part) continue;
    const lower = part.toLowerCase();
    const already = collected.some((c) => c.toLowerCase().includes(lower));
    if (already) continue;
    collected.push(part);
  }
  return collected.length ? collected.join(", ") : null;
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    formatted_address: string;
    partial_match?: boolean;
    geometry: {
      location: { lat: number; lng: number };
      location_type: string;
    };
  }>;
}

const postSchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().trim().max(500).optional(),
});

// POST { sessionId, query? } — geocode an address to candidate pins. No DB write.
export async function POST(req: NextRequest) {
  if (sessionRatelimit) {
    const { success } = await sessionRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await req.json());
  } catch {
    return fail("parse");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY is not set");
    return fail("not_configured");
  }

  const session = await prisma.quoteSession.findUnique({
    where: { id: body.sessionId },
    select: {
      id: true,
      rawAddress: true,
      addressTown: true,
      addressCity: true,
      addressState: true,
      addressCountry: true,
    },
  });
  if (!session) return fail("not_found");

  // A free-text search override beats the stored address; otherwise build one.
  const query = body.query?.trim() || buildQuery(session);
  if (!query) return fail("no_address");

  let data: GoogleGeocodeResponse;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);
    const res = await fetch(url, { cache: "no-store" });
    data = (await res.json()) as GoogleGeocodeResponse;
  } catch (err) {
    console.error("Geocoding request failed", err);
    return fail("geocode_failed");
  }

  if (data.status === "ZERO_RESULTS") return fail("no_results");
  if (data.status !== "OK" || !data.results?.length) {
    // OVER_QUERY_LIMIT / REQUEST_DENIED / INVALID_REQUEST / UNKNOWN_ERROR
    console.error("Geocoding returned", data.status);
    return fail("geocode_failed");
  }

  const candidates: Candidate[] = data.results.slice(0, 5).map((r) => {
    const partialMatch = Boolean(r.partial_match);
    return {
      formattedAddress: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      locationType: r.geometry.location_type,
      partialMatch,
      confidence: confidenceFor(r.geometry.location_type, partialMatch),
    };
  });

  return NextResponse.json({ success: true, candidates });
}

// PATCH { sessionId, lat, lng, formattedAddress? } — persist the confirmed pin.
const patchSchema = z.object({
  sessionId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  formattedAddress: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return fail("parse");
  }

  const { sessionId, lat, lng, formattedAddress } = body;
  try {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: {
        lat,
        lng,
        formattedAddress: formattedAddress ?? undefined,
        status: QuoteStatus.LOCATED,
      },
    });
  } catch (err) {
    console.error("Saving confirmed location failed", err);
    return fail("not_found");
  }

  return NextResponse.json({ success: true });
}
