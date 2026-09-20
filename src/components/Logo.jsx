export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="logo-mark" aria-hidden="true">
        K
      </div>
      {!compact && <span className="font-display text-xl font-black">kantong.</span>}
    </div>
  );
}
