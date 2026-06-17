import { Badge } from "@/components/ui/badge";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_VARIANT,
  type LeadStatusValue,
} from "@/lib/lead-status";

export function LeadStatusBadge({ status }: { status: LeadStatusValue }) {
  return (
    <Badge variant={LEAD_STATUS_VARIANT[status]}>
      {LEAD_STATUS_LABEL[status]}
    </Badge>
  );
}
