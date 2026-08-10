import logo from "@/assets/al-shifa-logo.png.asset.json";
import { cn } from "@/lib/utils";

export const LOGO_URL = logo.url;

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Al Shifa Family Clinic logo"
      className={cn("object-contain", className)}
    />
  );
}

export function BrandLockup({
  className,
  compact = false,
  invert = false,
}: {
  className?: string;
  compact?: boolean;
  invert?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-card p-1",
          compact ? "size-9" : "size-11",
        )}
      >
        <Logo className="size-full" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              "truncate text-sm font-bold tracking-wide",
              invert ? "text-sidebar-foreground" : "text-foreground",
            )}
          >
            AL SHIFA FAMILY CLINIC
          </p>
          <p
            className={cn(
              "truncate text-xs",
              invert ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            Dr. Saqlain Abbas Chattha
          </p>
        </div>
      )}
    </div>
  );
}
