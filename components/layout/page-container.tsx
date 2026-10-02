const pageClass =
  "mx-auto w-full max-w-[76rem] px-5 sm:px-8 lg:px-10 py-6 sm:py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]";

export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className={pageClass}>{children}</div>;
}

export { pageClass };
