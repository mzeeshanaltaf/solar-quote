import "server-only";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";

import { ExtractedBillSchema, type ExtractedBill } from "@/lib/bill-schema";

export type { ExtractedBill };

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const EXTRACTION_MODEL = process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-5.4-mini";

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly stage: "ocr" | "llm"
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

/**
 * Run Mistral OCR over a bill supplied as base64 (the bytes are read back from
 * the private Vercel Blob store, so nothing is exposed publicly) and return the
 * concatenated markdown of every page.
 */
export async function ocrBill(
  base64: string,
  mimeType: string | null | undefined
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new ExtractionError("MISTRAL_API_KEY is not set", "ocr");
  }

  const dataUrl = `data:${mimeType ?? "application/pdf"};base64,${base64}`;

  // Images and PDFs use different document descriptors on the OCR endpoint.
  const document = isImageMime(mimeType)
    ? { type: "image_url" as const, image_url: dataUrl }
    : { type: "document_url" as const, document_url: dataUrl };

  let res: Response;
  try {
    res = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "mistral-ocr-latest", document }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new ExtractionError(
      `Mistral OCR request failed: ${(err as Error).message}`,
      "ocr"
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ExtractionError(
      `Mistral OCR responded ${res.status}: ${detail.slice(0, 300)}`,
      "ocr"
    );
  }

  const data = (await res.json()) as {
    pages?: Array<{ markdown?: string }>;
  };
  const markdown = (data.pages ?? [])
    .map((p) => p.markdown ?? "")
    .join("\n\n---\n\n")
    .trim();

  if (!markdown) {
    throw new ExtractionError("OCR returned no text", "ocr");
  }
  return markdown;
}

const SYSTEM_PROMPT = `You read residential and commercial electricity bills from anywhere in the world and extract a few structured fields. Bills have no fixed schema, language, or currency.

Rules:
- FIRST decide whether the document is actually an electricity or utility bill. Set "isElectricityBill" to true only if it is. If it is clearly something else (a different invoice, a receipt, a letter, an ID, a random photo, blank/garbled text), set "isElectricityBill" to false, write a short friendly "rejectionReason" describing what it looks like instead, and set every other field to null. When it IS a bill, set "rejectionReason" to null.
- Extract ONLY what is actually printed on the bill. If a field is not present, return null for it — never guess or fabricate a value.
- "currency" must be the ISO 4217 code (USD, EUR, GBP, PKR, INR, AUD, ...). Infer it from the currency symbol, language, and address if not stated explicitly.
- "kWhUsed" is the electricity consumed during this billing period in kWh. Convert units if the bill uses MWh or units (1 unit = 1 kWh in most regions).
- "billAmount" is the total amount due for this period as a plain number, with no currency symbol or thousands separators.
- "billingPeriodDays" is the number of days the bill covers (compute it from the period start/end dates if only dates are shown; a typical monthly bill is ~30).
- For the location: "rawAddress" is the FULL service/supply address exactly as printed (including house/flat number and street). Separately, break out COARSE components: "addressTown" (town/area/locality), "addressCity" (city), "addressState" (state/province/region), and "addressCountry" (country) — these components must NOT contain the house/flat number or street. If a value isn't present, return null for it. Infer the country from the language, currency, and utility when it isn't printed.
- For every field, also report a confidence of "low", "medium", or "high". Use "low" whenever a value was inferred, ambiguous, or null.`;

/**
 * Send OCR markdown to the LLM and return typed bill fields.
 */
export async function extractFields(markdown: string): Promise<ExtractedBill> {
  try {
    const { object } = await generateObject({
      model: openai(EXTRACTION_MODEL),
      schema: ExtractedBillSchema,
      schemaName: "ElectricityBill",
      schemaDescription: "Structured fields extracted from an electricity bill.",
      system: SYSTEM_PROMPT,
      prompt: `Here is the OCR'd text of an electricity bill in markdown. Extract the fields.\n\n${markdown}`,
      providerOptions: {
        openai: {
          reasoningEffort: "medium",
          // "flex" trades latency for a lower price — fine for this background
          // extraction step where a few extra seconds don't hurt UX.
          serviceTier: "flex",
        },
      },
    });
    return object;
  } catch (err) {
    throw new ExtractionError(
      `Structured extraction failed: ${(err as Error).message}`,
      "llm"
    );
  }
}

/**
 * Single-call alternative to ocrBill + extractFields: send the raw bill image or
 * PDF straight to the vision model and get the same typed fields back. Drops the
 * separate OCR hop. Same schema, prompt, and model as extractFields — only the
 * input changes (the document itself instead of OCR'd markdown).
 */
export async function extractFromFile(
  base64: string,
  mimeType: string | null | undefined
): Promise<ExtractedBill> {
  // Images go in as image parts; everything else (PDF) as a file part. OpenAI
  // supports both for its vision models.
  const filePart = isImageMime(mimeType)
    ? ({ type: "image" as const, image: base64 })
    : ({
        type: "file" as const,
        mediaType: mimeType ?? "application/pdf",
        data: base64,
      });

  try {
    const { object } = await generateObject({
      model: openai(EXTRACTION_MODEL),
      schema: ExtractedBillSchema,
      schemaName: "ElectricityBill",
      schemaDescription: "Structured fields extracted from an electricity bill.",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a customer's electricity bill. Read it directly and extract the fields.",
            },
            filePart,
          ],
        },
      ],
      providerOptions: {
        openai: {
          reasoningEffort: "medium",
        },
      },
    });
    return object;
  } catch (err) {
    throw new ExtractionError(
      `Vision extraction failed: ${(err as Error).message}`,
      "llm"
    );
  }
}
