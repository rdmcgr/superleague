export default function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="glass rounded-2xl p-8 text-center">
      <p className="animate-pulse text-slate-200">{label}</p>
    </div>
  );
}
