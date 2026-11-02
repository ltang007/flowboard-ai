export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative size-9">
        <span className="absolute left-2.5 top-0 size-4 rounded-full bg-primary" />
        <span className="absolute bottom-0 left-0 size-4 rounded-full bg-violet" />
        <span className="absolute bottom-0 right-0 size-4 rounded-full bg-tag-pink-fg" />
      </div>
      {!compact && <span className="font-display text-xl font-bold">Flowboard</span>}
    </div>
  );
}
