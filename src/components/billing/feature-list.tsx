import { Check, X } from "lucide-react";
import type { PlanFeatures } from "@/types/billing";

interface FeatureItem {
  label: string;
  getValue: (f: PlanFeatures) => string | boolean | number | null;
  format?: (v: string | boolean | number | null) => string;
}

const FEATURES: FeatureItem[] = [
  {
    label: "API calls / month",
    getValue: (f) => f.apiCallsPerMonth,
    format: (v) => v === -1 ? "Unlimited" : Number(v).toLocaleString(),
  },
  {
    label: "Storage",
    getValue: (f) => f.storageGb,
    format: (v) => `${v} GB`,
  },
  {
    label: "Team members",
    getValue: (f) => f.teamMembers,
    format: (v) => v === -1 ? "Unlimited" : String(v),
  },
  {
    label: "Projects",
    getValue: (f) => f.projects,
    format: (v) => v === -1 ? "Unlimited" : String(v),
  },
  { label: "API access", getValue: (f) => f.apiAccess },
  { label: "Custom domain", getValue: (f) => f.customDomain },
  { label: "Advanced analytics", getValue: (f) => f.advancedAnalytics },
  { label: "Audit log", getValue: (f) => f.auditLog },
  { label: "SSO / SAML", getValue: (f) => f.ssoSaml },
  { label: "Priority support", getValue: (f) => f.prioritySupport },
  { label: "Custom branding", getValue: (f) => f.customBranding },
  { label: "Dedicated infrastructure", getValue: (f) => f.dedicatedInfrastructure },
  {
    label: "Uptime SLA",
    getValue: (f) => f.uptimeSlaPercent,
    format: (v) => v === null ? "—" : `${v}%`,
  },
];

interface FeatureListProps {
  features: PlanFeatures;
  highlighted?: boolean;
}

export function FeatureList({ features, highlighted = false }: FeatureListProps) {
  return (
    <ul className="space-y-2.5 text-sm">
      {FEATURES.map(({ label, getValue, format }) => {
        const raw = getValue(features);
        const isBoolean = typeof raw === "boolean";

        if (isBoolean && raw === false) {
          return (
            <li key={label} className="flex items-center gap-2 text-muted-foreground">
              <X className="h-4 w-4 shrink-0 opacity-50" />
              <span>{label}</span>
            </li>
          );
        }

        const display = format ? format(raw) : raw === true ? label : String(raw ?? "—");

        return (
          <li key={label} className="flex items-center gap-2">
            <Check
              className={`h-4 w-4 shrink-0 ${highlighted ? "text-primary" : "text-green-500"}`}
            />
            <span>
              {isBoolean ? label : <><span className="font-medium">{display}</span> {label}</>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
