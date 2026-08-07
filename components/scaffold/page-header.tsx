export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <p className="mb-2 font-bold text-xs text-success uppercase tracking-eyebrow">
          {eyebrow}
        </p>
      )}
      <h1 className="font-black text-3xl text-base-content tracking-normal">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-base-content/60 text-sm leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
