import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>button]:max-sm:flex-1">
          {actions}
        </div>
      )}
    </div>
  );
}

const TONES = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p
              className={cn(
                "tabular mt-1 whitespace-normal text-xl font-bold leading-tight [overflow-wrap:anywhere] md:text-2xl",
                TONES[tone],
              )}
            >
              {value}
            </p>
          )}
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("shrink-0 rounded-md bg-muted p-2", TONES[tone])} aria-hidden>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}
