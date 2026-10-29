const RENOVATION_LABEL: Record<string, string> = {
  grandma: "Бабушкин",
  cosmetic: "Косметика",
  euro: "Евро",
  designer: "Дизайн",
  not_grandma: "Без бабушкиного",
};

export function renovationLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return RENOVATION_LABEL[value] || value;
}

/** Short chip for listing cards */
export function renovationBadge(value: string | null | undefined): string | null {
  const label = renovationLabel(value);
  return label ? `🛋 ${label}` : null;
}
