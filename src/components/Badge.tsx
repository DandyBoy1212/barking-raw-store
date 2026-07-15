import type { Badge as BadgeType } from "@/data/products";

export function Badge({ label }: { label: BadgeType }) {
  const isStar = label === "Most Popular";
  return (
    <span className={isStar ? "badge badge--star" : "badge"}>
      {isStar ? "★ " : ""}
      {label}
    </span>
  );
}
