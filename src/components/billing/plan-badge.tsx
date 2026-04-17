import { Badge } from "@/components/ui/badge";
import type { PlanTier } from "@/types/billing";

interface PlanBadgeProps {
  tier: PlanTier;
  className?: string;
}

const TIER_CONFIG: Record<PlanTier, { label: string; variant: "default" | "secondary" | "outline" }> = {
  free: { label: "Free", variant: "outline" },
  pro: { label: "Pro", variant: "default" },
  enterprise: { label: "Enterprise", variant: "secondary" },
};

export function PlanBadge({ tier, className }: PlanBadgeProps) {
  const { label, variant } = TIER_CONFIG[tier];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
