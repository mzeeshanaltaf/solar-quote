"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, Loader2Icon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/lead-status";

const ALL = "all";

interface LeadsFiltersProps {
  status: string; // "all" | LeadStatusValue
  query: string;
}

// Filter controls for the leads table. They write to the URL search params so
// the server component re-queries — the list stays a Server Component and the
// filters survive refresh/back/forward and are shareable.
export function LeadsFilters({ status, query }: LeadsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(query);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Re-sync the input if the URL query changes from outside this component
  // (e.g. browser back/forward). React's "adjust state during render" pattern,
  // which avoids the cascading-render cost of doing this in an effect.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setQ(query);
  }

  const push = (next: { status?: string; q?: string }) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextQ = next.q ?? q;
    if (nextStatus && nextStatus !== ALL) params.set("status", nextStatus);
    if (nextQ.trim()) params.set("q", nextQ.trim());
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/admin?${qs}` : "/admin"));
  };

  const onSearchChange = (value: string) => {
    setQ(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => push({ q: value }), 350);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          aria-label="Search leads"
        />
        {isPending && (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      <Select value={status || ALL} onValueChange={(v) => push({ status: v })}>
        <SelectTrigger className="sm:w-52" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
