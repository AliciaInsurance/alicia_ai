import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/alicia-logo";
import { LoginErrorBanner } from "@/components/auth/login-error-banner";
import { nl } from "@/lib/i18n/nl";

function ForestGrain() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay"
      aria-hidden="true"
    >
      <filter id="login-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#login-grain)" />
    </svg>
  );
}

function ForestRings() {
  return (
    <svg
      className="pointer-events-none absolute -right-24 -top-20 h-[28rem] w-[28rem] text-cream/80"
      viewBox="0 0 400 400"
      aria-hidden="true"
    >
      <circle cx="200" cy="200" r="168" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.16" />
      <circle cx="200" cy="200" r="118" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="200" cy="200" r="68" fill="none" stroke="#effb00" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

export function LoginScreen({
  errorMessage,
  children,
}: {
  errorMessage: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-cream p-3 sm:p-4 lg:p-5">
      <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col gap-3 sm:min-h-[calc(100dvh-2rem)] lg:min-h-[calc(100dvh-2.5rem)] lg:flex-row lg:gap-5">
        <section className="login-forest relative flex flex-col overflow-hidden rounded-[24px] px-7 py-8 text-white sm:px-10 sm:py-10 lg:min-h-full lg:flex-[1.15] lg:rounded-[28px] lg:px-12 lg:py-12">
          <ForestGrain />
          <ForestRings />

          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <div className="site-fade-up">
              <BrandLockup size="login" inverted href={null} />
            </div>

            <div className="site-fade-up login-delay-1 mt-14 max-w-lg lg:mt-20">
              <span className="block h-1 w-12 rounded-full bg-accent" aria-hidden="true" />
              <p className="mt-6 max-w-sm text-2xl font-medium leading-snug tracking-[-0.02em] text-white sm:text-3xl">
                {nl.login.lead}
              </p>
            </div>

            <div className="site-fade-up login-delay-3 mt-10 flex items-center gap-3 text-[12px] text-white/55 lg:mt-auto lg:pt-10">
              <span>{nl.login.footer}</span>
              <span className="h-1 w-1 rounded-full bg-accent" />
              <span>{nl.login.location}</span>
              <span className="hidden h-1 w-1 rounded-full bg-accent sm:block" />
              <span className="hidden sm:inline">ask.alicia.insure</span>
            </div>
          </div>
        </section>

        <section className="relative flex flex-1 flex-col rounded-[24px] px-6 py-10 sm:px-10 lg:flex-[0.85] lg:rounded-[28px] lg:px-8 lg:py-8">
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full max-w-[22.5rem]">
              <div className="site-fade-up">
                <p className="eyebrow">{nl.login.welcome}</p>
                <h2 className="mt-3 font-display text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.125rem]">
                  {nl.login.title}
                </h2>
                <p className="mt-3 text-[17px] leading-relaxed text-muted">{nl.login.subtitle}</p>
              </div>

              {errorMessage ? <LoginErrorBanner message={errorMessage} /> : null}

              <div className="site-fade-up login-delay-1 mt-8">{children}</div>

              <p className="site-fade-up login-delay-2 mt-5 text-center text-[13px] text-stone">
                {nl.login.restricted}
              </p>
            </div>
          </div>

          <p className="pt-8 text-center text-[12px] text-stone lg:pb-2 lg:pt-4">
            {nl.login.legal}
          </p>
        </section>
      </div>
    </div>
  );
}
