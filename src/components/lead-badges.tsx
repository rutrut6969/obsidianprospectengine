import { WebsiteStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { scoreBadgeVariant } from "@/lib/lead-scoring";
import { WEBSITE_STATUS_LABELS } from "@/types/lead";

const statusVariants: Record<WebsiteStatus, "green" | "purple" | "amber" | "red" | "slate"> = {
  NO_WEBSITE: "green",
  FACEBOOK_ONLY: "green",
  BROKEN_WEBSITE: "amber",
  OUTDATED_WEBSITE: "amber",
  HAS_WEBSITE: "slate",
  UNKNOWN: "slate",
};

export function WebsiteStatusBadge({ status }: { status: WebsiteStatus }) {
  return (
    <Badge variant={statusVariants[status] ?? "slate"}>
      {WEBSITE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function LeadScoreBadge({ score }: { score: number }) {
  const variant = scoreBadgeVariant(score);
  const badgeVariant =
    variant === "high" ? "score-high" : variant === "medium" ? "score-medium" : "score-low";
  return <Badge variant={badgeVariant}>{score}</Badge>;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const colors: Record<string, "purple" | "green" | "amber" | "slate" | "red"> = {
    NEW: "slate",
    SAVED: "purple",
    CONTACTED: "amber",
    INTERESTED: "green",
    NOT_INTERESTED: "red",
    CLIENT: "green",
    ARCHIVED: "slate",
  };
  return (
    <Badge variant={colors[status] ?? "slate"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
