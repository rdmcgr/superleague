export function prettyStatus(status: string) {
  if (status === "draft") return "Preview";
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

export function shortDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}
