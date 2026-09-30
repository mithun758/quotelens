export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">{description}</p>
    </section>
  );
}
