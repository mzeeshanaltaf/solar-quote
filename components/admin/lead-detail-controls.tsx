"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  type LeadStatusValue,
} from "@/lib/lead-status";

interface LeadDetailControlsProps {
  leadId: string;
  initialStatus: LeadStatusValue;
  initialNotes: string;
}

type Save = "idle" | "saving" | "saved" | "error";

export function LeadDetailControls({
  leadId,
  initialStatus,
  initialNotes,
}: LeadDetailControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatusValue>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [save, setSave] = useState<Save>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const dirty = status !== initialStatus || notes !== initialNotes;

  const persist = async (payload: { status?: LeadStatusValue; notes?: string }) => {
    setSave("saving");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!data.success) {
        setSave("error");
        setErrorMsg(data.message ?? "Couldn't save. Try again.");
        return;
      }
      setSave("saved");
      // Re-fetch the server component so the rest of the page (and the list on
      // back-nav) reflects the new values.
      router.refresh();
      setTimeout(() => setSave("idle"), 1500);
    } catch {
      setSave("error");
      setErrorMsg("Couldn't save. Check your connection.");
    }
  };

  // Status changes save immediately — it's the primary triage action.
  const onStatusChange = (value: string) => {
    const next = value as LeadStatusValue;
    setStatus(next);
    void persist({ status: next, notes });
  };

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="lead-status">Status</FieldLabel>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger id="lead-status" className="w-full sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="lead-notes">Internal notes</FieldLabel>
        <Textarea
          id="lead-notes"
          rows={5}
          maxLength={2000}
          placeholder="Call outcomes, partner assignment, follow-ups…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => persist({ status, notes })}
          disabled={!dirty || save === "saving"}
        >
          {save === "saving" ? (
            <Spinner data-icon="inline-start" />
          ) : save === "saved" ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          {save === "saved" ? "Saved" : "Save changes"}
        </Button>
        {save === "error" && (
          <span className="text-sm text-destructive">{errorMsg}</span>
        )}
      </div>
    </div>
  );
}
