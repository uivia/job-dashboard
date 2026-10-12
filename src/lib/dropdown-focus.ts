export function getNextTabStop<T extends { tabIndex: number }>(
  elements: readonly T[],
  current: T,
  backwards = false
): T | undefined {
  const tabStops = elements.filter((element) => element.tabIndex >= 0);
  const currentIndex = tabStops.indexOf(current);
  if (currentIndex === -1) return undefined;
  return tabStops[currentIndex + (backwards ? -1 : 1)];
}
