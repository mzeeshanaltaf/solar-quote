import { z } from "zod";

// Single source of truth for the fields we read off a bill. Shared by the
// server extraction pipeline, the extract route, and the client review form.
// Every field is nullable: the bill may not contain it, and the model must
// emit null rather than guess. This module is client-safe (no server-only deps).
export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ExtractedBillSchema = z.object({
  kWhUsed: z
    .number()
    .nullable()
    .describe("Total electricity consumed in the billing period, in kWh."),
  billAmount: z
    .number()
    .nullable()
    .describe("Total amount due/paid on the bill, as a number (no currency symbol)."),
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 currency code of the bill amount, e.g. USD, EUR, PKR."),
  billingPeriodDays: z
    .number()
    .int()
    .nullable()
    .describe("Length of the billing period in days (e.g. 30 for a monthly bill)."),
  rawAddress: z
    .string()
    .nullable()
    .describe("The full service/property address exactly as printed on the bill, including house number and street."),
  addressTown: z
    .string()
    .nullable()
    .describe("Town, area, or locality of the property. NOT the house number or street."),
  addressCity: z
    .string()
    .nullable()
    .describe("City the property is in."),
  addressState: z
    .string()
    .nullable()
    .describe("State, province, or region the property is in."),
  addressCountry: z
    .string()
    .nullable()
    .describe("Country the property is in."),
  utilityName: z
    .string()
    .nullable()
    .describe("Name of the electricity provider / utility company."),
  confidence: z
    .object({
      kWhUsed: ConfidenceSchema,
      billAmount: ConfidenceSchema,
      currency: ConfidenceSchema,
      billingPeriodDays: ConfidenceSchema,
      rawAddress: ConfidenceSchema,
      addressTown: ConfidenceSchema,
      addressCity: ConfidenceSchema,
      addressState: ConfidenceSchema,
      addressCountry: ConfidenceSchema,
      utilityName: ConfidenceSchema,
    })
    .describe("Per-field confidence: 'low' for any field that was guessed or is null."),
});

export type ExtractedBill = z.infer<typeof ExtractedBillSchema>;
