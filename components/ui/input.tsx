import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    const isDate = type === "date";
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "h-11 w-full min-w-0 max-w-full rounded-2xl border border-input-border bg-cream text-ink placeholder:text-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          isDate
            ? "date-input block appearance-none px-3 text-base leading-none"
            : "flex px-4 py-2 text-[15px]",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
