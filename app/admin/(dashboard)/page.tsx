import Link from "next/link";
import { ChevronRightIcon, InboxIcon } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Prisma, LeadStatus } from "@/generated/client";
import { isLeadStatus, type LeadStatusValue } from "@/lib/lead-status";
import { formatMoney } from "@/lib/solar-math";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadStatusBadge } from "@/components/admin/lead-status-badge";
import { LeadsFilters } from "@/components/admin/leads-filters";

const dateFmt = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const { status: statusParam, q: qParam } = await searchParams;
  const statusFilter: LeadStatusValue | undefined =
    statusParam && isLeadStatus(statusParam) ? statusParam : undefined;
  const query = (qParam ?? "").trim();

  const where: Prisma.LeadWhereInput = {};
  if (statusFilter) where.status = statusFilter as LeadStatus;
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  const [leads, totalCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        quoteSession: {
          select: {
            addressCity: true,
            addressCountry: true,
            currency: true,
            annualSavings: true,
          },
        },
      },
    }),
    prisma.lead.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {totalCount === 0
            ? "No leads captured yet."
            : `${totalCount} lead${totalCount === 1 ? "" : "s"} captured. Showing ${leads.length === 100 ? "the latest 100" : `${leads.length}`}.`}
        </p>
      </div>

      <LeadsFilters status={statusParam ?? "all"} query={query} />

      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <InboxIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {statusFilter || query
              ? "No leads match these filters."
              : "Leads will appear here as homeowners request quotes."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Location</TableHead>
                <TableHead className="hidden md:table-cell">Est. savings/yr</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="w-10" aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const loc = [lead.quoteSession.addressCity, lead.quoteSession.addressCountry]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <TableRow key={lead.id} className="relative cursor-pointer">
                    {/* The name cell's Link spans the whole row via an
                        absolutely-positioned ::after overlay (row is relative). */}
                    <TableCell>
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="flex flex-col after:absolute after:inset-0"
                      >
                        <span className="font-medium">{lead.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {lead.email}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {loc || "—"}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {lead.quoteSession.annualSavings != null
                        ? formatMoney(
                            lead.quoteSession.annualSavings,
                            lead.quoteSession.currency
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status as LeadStatusValue} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {dateFmt.format(lead.createdAt)}
                    </TableCell>
                    <TableCell>
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
