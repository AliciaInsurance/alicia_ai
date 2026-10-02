import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "accent" | "forest";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        {
          "bg-cream text-muted ring-1 ring-ink/5": variant === "default",
          "border border-ink/10 text-muted": variant === "outline",
          "bg-accent/30 text-ink": variant === "accent",
          "bg-forest/10 text-forest": variant === "forest",
        },
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const colors: Record<string, string> = {
    active: "bg-success-bg text-forest",
    inactive: "bg-cream text-stone ring-1 ring-ink/5",
    uploaded: "bg-cream text-muted ring-1 ring-ink/5",
    processing: "bg-warn-bg text-warn",
    ready: "bg-success-bg text-forest",
    failed: "bg-danger-bg text-danger",
    unsupported: "bg-danger-bg text-danger",
    draft: "bg-cream text-muted ring-1 ring-ink/5",
    pending_review: "bg-warn-bg text-warn",
    approved: "bg-success-bg text-forest",
    rejected: "bg-danger-bg text-danger",
    error: "bg-danger-bg text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        colors[normalized] ?? colors.inactive,
      )}
    >
      {status}
    </span>
  );
}
