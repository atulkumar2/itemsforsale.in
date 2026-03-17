export default function Loading() {
  return (
    <div className="shell flex min-h-screen items-center justify-center py-20">
      <div className="panel w-full max-w-xl p-10 text-center">
        <p className="eyebrow mx-auto">Loading</p>
        <h1 className="display-title mt-6 text-4xl font-semibold text-stone-900">
          Preparing the catalogue
        </h1>
        <p className="mt-3 text-[color:var(--muted)]">
          Fetching the current item list and local data state.
        </p>
      </div>
    </div>
  );
}