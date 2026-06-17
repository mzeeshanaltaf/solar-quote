import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import type { LeadStatusValue } from "@/lib/lead-status";
import {
  formatKwh,
  formatKwp,
  formatMoney,
  formatYears,
} from "@/lib/solar-math";
import { Separator } from "@/components/ui/separator";
import { LeadStatusBadge } from "@/components/admin/lead-status-badge";
import { LeadDetailControls } from "@/components/admin/lead-detail-controls";
import { MapThumbnail } from "@/components/admin/map-thumbnail";
import { AdminBillPanel } from "@/components/admin/admin-bill-panel";

const dateFmt = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const CONTACT_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone call",
  whatsapp: "WhatsApp",
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums">
        {value ?? "—"}
      </dd>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { quoteSession: true },
  });
  if (!lead) notFound();

  const s = lead.quoteSession;
  const currency = s.currency;
  const billLoc = [s.addressCity, s.addressState, s.addressCountry]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          All leads
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">
              Submitted {dateFmt.format(lead.createdAt)}
            </p>
          </div>
          <LeadStatusBadge status={lead.status as LeadStatusValue} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Card title="Contact">
            <div className="flex flex-col gap-3">
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-2.5 text-sm hover:text-primary"
              >
                <MailIcon className="size-4 text-muted-foreground" />
                {lead.email}
              </a>
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2.5 text-sm hover:text-primary"
                >
                  <PhoneIcon className="size-4 text-muted-foreground" />
                  {lead.phone}
                </a>
              )}
              {lead.preferredContact && (
                <p className="text-sm text-muted-foreground">
                  Prefers{" "}
                  <span className="font-medium text-foreground">
                    {CONTACT_LABEL[lead.preferredContact] ?? lead.preferredContact}
                  </span>
                </p>
              )}
            </div>
          </Card>

          <Card title="Triage">
            <LeadDetailControls
              leadId={lead.id}
              initialStatus={lead.status as LeadStatusValue}
              initialNotes={lead.notes ?? ""}
            />
          </Card>

          <Card title="Estimate">
            <dl className="flex flex-col">
              <Row
                label="System size"
                value={s.systemKwp != null ? formatKwp(s.systemKwp) : null}
              />
              <Row
                label="Annual production"
                value={
                  s.annualProductionKwh != null
                    ? formatKwh(s.annualProductionKwh)
                    : null
                }
              />
              <Row
                label="Annual savings"
                value={
                  s.annualSavings != null
                    ? formatMoney(s.annualSavings, currency)
                    : null
                }
              />
              <Row
                label="Payback"
                value={s.paybackYears != null ? formatYears(s.paybackYears) : null}
              />
              <Row
                label="Specific yield"
                value={
                  s.specificYield != null
                    ? `${Math.round(s.specificYield).toLocaleString()} kWh/kWp/yr`
                    : null
                }
              />
              <Row label="Funnel status" value={s.status} />
            </dl>
          </Card>

          <Card title="Bill data (extracted)">
            <dl className="flex flex-col">
              <Row
                label="Consumption"
                value={s.kWhUsed != null ? formatKwh(s.kWhUsed) : null}
              />
              <Row
                label="Bill amount"
                value={
                  s.billAmount != null
                    ? formatMoney(s.billAmount, currency, 2)
                    : null
                }
              />
              <Row label="Currency" value={s.currency} />
              <Row
                label="Billing period"
                value={
                  s.billingPeriodDays != null ? `${s.billingPeriodDays} days` : null
                }
              />
              <Row label="Utility" value={s.utilityName} />
              <Row label="Address on bill" value={billLoc || s.rawAddress} />
            </dl>
          </Card>
        </div>

        {/* Aside: location + original bill */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card title="Location">
            {s.lat != null && s.lng != null ? (
              <div className="flex flex-col gap-3">
                <MapThumbnail
                  lat={s.lat}
                  lng={s.lng}
                  label={s.formattedAddress}
                />
                {s.formattedAddress && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {s.formattedAddress}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No confirmed roof location for this lead.
              </p>
            )}
          </Card>

          <Card title="Original bill">
            {s.blobUrl ? (
              <AdminBillPanel sessionId={s.id} mimeType={s.fileMimeType} />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
                <FileTextIcon className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No bill uploaded — this lead came through manual entry.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Session ID <span className="font-mono">{s.id}</span>
      </p>
    </div>
  );
}
