export default function Notice({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "success" | "danger" }) {
  const cls =
    tone === "success"
      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
      : tone === "danger"
        ? "border-rose-300/35 bg-rose-300/10 text-rose-100"
        : "border-cyan-300/35 bg-cyan-300/10 text-cyan-100";

  return <p className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{text}</p>;
}
