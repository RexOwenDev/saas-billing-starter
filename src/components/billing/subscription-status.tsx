import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanBadge } from "./plan-badge";
import type { SubscriptionState } from "@/types/billing";

interface SubscriptionStatusProps {
  state: SubscriptionState;
}

const STATUS_COLOR: Record<string, string> = {
  active: "text-green-600 dark:text-green-400",
  trialing: "text-blue-600 dark:text-blue-400",
  past_due: "text-red-600 dark:text-red-400",
  canceled: "text-muted-foreground",
  paused: "text-yellow-600 dark:text-yellow-400",
  unpaid: "text-red-600 dark:text-red-400",
};

export function SubscriptionStatus({ state }: SubscriptionStatusProps) {
  const statusColor = STATUS_COLOR[state.status] ?? "text-muted-foreground";
  const renewalDate = state.currentPeriodEnd.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          Current Plan
          <PlanBadge tier={state.tier} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className={`font-medium capitalize ${statusColor}`}>
              {state.status.replace("_", " ")}
            </p>
          </div>

          {state.tier !== "free" && (
            <div>
              <p className="text-muted-foreground">
                {state.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
              </p>
              <p className="font-medium">{renewalDate}</p>
            </div>
          )}

          {state.isTrialing && state.trialEnd && (
            <div>
              <p className="text-muted-foreground">Trial ends</p>
              <p className="font-medium">
                {state.trialEnd.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        {state.status === "past_due" && (
          <Alert variant="destructive">
            <AlertDescription>
              Your last payment failed. Please update your payment method to
              continue using your plan.
            </AlertDescription>
          </Alert>
        )}

        {state.cancelAtPeriodEnd && (
          <Alert>
            <AlertDescription>
              Your subscription will be canceled on {renewalDate}. You can
              reactivate at any time before then.
            </AlertDescription>
          </Alert>
        )}

        {state.isTrialing && (
          <Badge variant="outline" className="text-blue-600 border-blue-300">
            Free trial active
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
