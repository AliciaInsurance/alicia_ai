export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="mt-2 font-display text-[1.875rem] font-bold tracking-[-0.03em] text-ink sm:text-[2.125rem]">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">{description}</p>
      ) : null}
    </header>
  );
}
