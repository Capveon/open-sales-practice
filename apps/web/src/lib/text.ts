export function similarUtterance(a: string, b: string): boolean {
  const na = a
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const nb = b
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 10 && (na.includes(nb) || nb.includes(na))) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length > 2));
  const wb = nb.split(" ").filter((w) => w.length > 2);
  if (wb.length === 0) return false;
  const hit = wb.filter((w) => wa.has(w)).length;
  return hit / wb.length >= 0.75 && nb.length >= 12;
}
