import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";
import {
  IrradianceError,
  getSpecificYield,
  roundKey,
} from "@/lib/irradiance";

// Phase 3.2 — Irradiance. Once a session has a confirmed pin, resolve the
// specific yield (kWh/kWp/yr) for that roof. We cache by rounded lat/lng so
// nearby sessions reuse one upstream PVGIS/NASA call. Same route shape as
// /api/geocode and /api/extract: typed error maps, a fail() helper, Zod body,
// the fail-open rate-limit guard, and the prisma singleton.

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  no_location: 409,
  rate: 429,
  irradiance_failed: 502,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that session. Please start over.",
  no_location: "We don't have a confirmed roof location yet.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  irradiance_failed:
    "We couldn't check the sunlight at your roof right now. We'll estimate it later.",
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

const postSchema = z.object({ sessionId: z.string().min(1) });

// POST { sessionId } — resolve and persist the specific yield for the confirmed
// pin. Cache by rounded lat/lng; only calls upstream on a miss.
export async function POST(req: NextRequest) {
  if (sessionRatelimit) {
    const { success } = await sessionRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  let sessionId: string;
  try {
    sessionId = postSchema.parse(await req.json()).sessionId;
  } catch {
    return fail("parse");
  }

  const session = await prisma.quoteSession.findUnique({
    where: { id: sessionId },
    select: { id: true, lat: true, lng: true },
  });
  if (!session) return fail("not_found");
  if (session.lat == null || session.lng == null) return fail("no_location");

  const latKey = roundKey(session.lat);
  const lngKey = roundKey(session.lng);

  // Cache hit: a nearby roof already resolved this rounded cell — reuse it and
  // skip the upstream call entirely.
  const cached = await prisma.irradianceCache.findUnique({
    where: { latKey_lngKey: { latKey, lngKey } },
  });

  let specificYield: number;
  let source: string;

  if (cached) {
    specificYield = cached.specificYield;
    source = cached.source;
  } else {
    try {
      const result = await getSpecificYield(session.lat, session.lng);
      specificYield = result.specificYield;
      source = result.source;
      await prisma.irradianceCache.upsert({
        where: { latKey_lngKey: { latKey, lngKey } },
        create: {
          latKey,
          lngKey,
          specificYield: result.specificYield,
          source: result.source,
          raw: result.raw as Prisma.InputJsonValue,
        },
        update: {
          specificYield: result.specificYield,
          source: result.source,
          raw: result.raw as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof IrradianceError) {
        console.error("Irradiance lookup failed:", err.message);
        return fail("irradiance_failed");
      }
      console.error("Irradiance lookup failed", err);
      return fail("server");
    }
  }

  // Persist on the session. Status stays LOCATED — Phase 4's estimate route is
  // what advances it to ESTIMATED.
  try {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: { specificYield },
    });
  } catch (err) {
    console.error("Persisting specific yield failed", err);
    return fail("server");
  }

  return NextResponse.json({ success: true, specificYield, source });
}
