export default function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="bg-hero text-hero-text">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-hero-text/75">{description}</p>
        )}
      </div>
    </section>
  );
}
