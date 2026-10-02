import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline" | "danger" | "forest";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-full",
          {
            "bg-accent text-ink hover:bg-accent-hover hover:shadow-[0_8px_24px_-8px_rgba(239,251,0,0.5)]":
              variant === "default",
            "bg-white text-ink border-2 border-ink/10 hover:border-forest/30 hover:bg-cream":
              variant === "secondary",
            "hover:bg-ink/5 text-ink": variant === "ghost",
            "border border-input-border bg-white hover:bg-cream": variant === "outline",
            "bg-danger text-white hover:bg-danger/90": variant === "danger",
            "bg-forest text-white hover:bg-forest/90": variant === "forest",
          },
          {
            "h-8 px-4 text-sm": size === "sm",
            "h-10 px-5 text-[15px]": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
