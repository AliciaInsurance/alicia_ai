import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { nl } from "@/lib/i18n/nl";

interface AliciaLogoProps {
  className?: string;
  height?: number;
  inverted?: boolean;
  href?: string | null;
}

const LOGO_ASPECT = 1200 / 471;

export function AliciaLogo({
  className,
  height = 20,
  inverted = false,
  href = "/assistants",
}: AliciaLogoProps) {
  const img = (
    <Image
      src={inverted ? "/alicia-logo-inverted.png" : "/alicia-logo.png"}
      alt="Alicia"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority
      unoptimized
      className={cn("h-auto w-auto", className)}
      style={{ height }}
    />
  );

  if (!href) return img;

  return (
    <Link href={href} className="shrink-0">
      {img}
    </Link>
  );
}

type BrandLockupSize = "nav" | "login";

export function BrandLockup({
  size = "nav",
  inverted = false,
  href = "/assistants",
}: {
  size?: BrandLockupSize;
  inverted?: boolean;
  href?: string | null;
}) {
  const logoHeight = size === "login" ? 22 : 20;
  const nameClass =
    size === "login" ? "text-[18px] text-white" : "text-[16px] text-forest";
  const dividerClass = inverted ? "bg-white/30" : "bg-forest/25";

  const mark = (
    <span className="flex items-center gap-2.5">
      <AliciaLogo height={logoHeight} inverted={inverted} href={null} />
      <span className={cn("h-4 w-px shrink-0", dividerClass)} aria-hidden="true" />
      <span
        className={cn(
          "font-display font-bold tracking-[-0.045em] leading-none",
          nameClass,
        )}
      >
        {nl.app.name}
      </span>
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} className="shrink-0">
      {mark}
    </Link>
  );
}
