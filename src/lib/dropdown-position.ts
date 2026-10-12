export type DropdownAnchor = Pick<DOMRect, "left" | "top" | "bottom" | "width">;

export function getDropdownPosition(
  anchor: DropdownAnchor,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  gap = 8
) {
  const margin = 8;
  const width = Math.min(anchor.width, Math.max(0, viewportWidth - margin * 2));
  const left = Math.max(margin, Math.min(anchor.left, viewportWidth - width - margin));
  const below = Math.max(0, viewportHeight - anchor.bottom - gap - margin);
  const above = Math.max(0, anchor.top - gap - margin);
  const placement = menuHeight > below && above > below ? "top" : "bottom";
  const available = placement === "top" ? above : below;
  const maxHeight = Math.min(menuHeight, available);
  const top = placement === "top"
    ? Math.max(margin, anchor.top - gap - maxHeight)
    : Math.min(anchor.bottom + gap, viewportHeight - margin - maxHeight);

  return { left, top, width, maxHeight, placement };
}
