// Client-safe lead-status metadata. Deliberately does NOT import the Prisma
// client (which would drag the whole DB layer into browser bundles): the string
// values here are identical to the Prisma `LeadStatus` enum, so server code can
// validate against LEAD_STATUSES and pass the value straight to Prisma.

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SENT_TO_PARTNER",
  "CLOSED",
  "JUNK",
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export function isLeadStatus(v: string): v is LeadStatusValue {
  return (LEAD_STATUSES as readonly string[]).includes(v);
}

export const LEAD_STATUS_LABEL: Record<LeadStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  SENT_TO_PARTNER: "Sent to partner",
  CLOSED: "Closed",
  JUNK: "Junk",
};

// Maps onto the Badge component's variants.
export const LEAD_STATUS_VARIANT: Record<
  LeadStatusValue,
  "default" | "secondary" | "outline" | "destructive"
> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "secondary",
  SENT_TO_PARTNER: "outline",
  CLOSED: "outline",
  JUNK: "destructive",
};
