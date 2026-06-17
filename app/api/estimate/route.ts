import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/client";
import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";
import {
  EstimateError,
  computeEstimate,
  type EstimateParams,
} from "@/lib/solar-math";

// Phase 4 — Sizing + Savings/ROI. Once a session has its bill figures and (ideally)
// a measured specific yield, compute the baseline estimate at 100% offset, persist
// the headline numbers + full breakdown, and advance the session to ESTIMATED. The
// results page re-runs the same pure math locally for the offset slider, so this
// route is only the durable baseline. Same route shape as the other phases: typed
// error maps, a fail() helper, a Zod body, the fail-open rate-limit guard.

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  insufficient: 422,
  rate: 429,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that session. Please start over.",
  insufficient:
    "We need both your electricity used (kWh) and your bill amount to estimate savings.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
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

// POST { sessionId } — compute + persist the baseline estimate (100% offset).
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
    select: {
      id: true,
      kWhUsed: true,
      billAmount: true,
      currency: true,
      billingPeriodDays: true,
      specificYield: true,
      addressCountry: true,
    },
  });
  if (!session) return fail("not_found");

  // Echo the resolved inputs back so the client's slider recomputes against the
  // exact same numbers (including the fallback yield, if one was used).
  const params: EstimateParams = {
    kWhUsed: session.kWhUsed,
    billAmount: session.billAmount,
    currency: session.currency,
    billingPeriodDays: session.billingPeriodDays,
    specificYield: session.specificYield,
    country: session.addressCountry,
  };

  let estimate;
  try {
    estimate = computeEstimate(params);
  } catch (err) {
    if (err instanceof EstimateError) return fail("insufficient");
    console.error("Estimate computation failed", err);
    return fail("server");
  }

  // Persist headline scalars (for the admin dashboard + lead context) and the
  // full breakdown. specificYield is written back so a fallback value is durable.
  try {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: {
        status: QuoteStatus.ESTIMATED,
        specificYield: estimate.specificYield,
        systemKwp: estimate.systemKwp,
        annualProductionKwh: estimate.annualProductionKwh,
        annualSavings: estimate.annualSavings,
        paybackYears: estimate.paybackYears,
        estimateJson: { params, ...estimate } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("Persisting estimate failed", err);
    return fail("server");
  }

  // params.specificYield carries the resolved value so the slider matches exactly.
  return NextResponse.json({
    success: true,
    params: { ...params, specificYield: estimate.specificYield },
    estimate,
  });
}
