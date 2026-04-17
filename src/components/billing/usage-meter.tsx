import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number; // -1 = unlimited
  unit?: string;
}

export function UsageMeter({ label, used, limit, unit = "" }: UsageMeterProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  const formatNumber = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{label}</span>
          {isAtLimit && (
            <Badge variant="destructive" className="text-xs">
              Limit reached
            </Badge>
          )}
          {isNearLimit && !isAtLimit && (
            <Badge
              variant="outline"
              className="text-xs text-yellow-600 border-yellow-400"
            >
              Near limit
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isUnlimited ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{formatNumber(used)}</span>
            {unit && ` ${unit}`} used · <span className="text-green-600">Unlimited</span>
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{formatNumber(used)}</span>
              {unit && ` ${unit}`} of{" "}
              <span className="font-medium text-foreground">{formatNumber(limit)}</span>
              {unit && ` ${unit}`} used
            </p>
            <Progress
              value={percentage}
              className={`h-2 ${
                isAtLimit
                  ? "[&>div]:bg-red-500"
                  : isNearLimit
                  ? "[&>div]:bg-yellow-500"
                  : ""
              }`}
            />
            <p className="text-xs text-muted-foreground">
              {(100 - percentage).toFixed(0)}% remaining
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
