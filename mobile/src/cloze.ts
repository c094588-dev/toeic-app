/** Hide the whole target form, including common inflections, without partial-word matches. */
export function clozeExample(word: string, example: string): string {
  const base = word.toLowerCase();
  const forms = new Set([base, base + "s", base + "es", base + "ed", base + "d", base + "ing"]);
  if (base.endsWith("e")) forms.add(base.slice(0, -1) + "ing");
  if (base.endsWith("y")) {
    for (const suffix of ["ies", "ied"]) forms.add(base.slice(0, -1) + suffix);
  }
  if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(base)) {
    forms.add(base + base.slice(-1) + "ed");
    forms.add(base + base.slice(-1) + "ing");
  }
  const irregular: Record<string, string[]> = { leaf: ["leaves"], "check-in": ["check in"] };
  for (const form of irregular[base] ?? []) forms.add(form);
  const escaped = [...forms].sort((a, b) => b.length - a.length)
    .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return example.replace(new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi"), "______");
}
