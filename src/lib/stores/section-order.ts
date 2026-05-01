export function loadSectionOrder<T extends string>(
  key: string,
  defaultOrder: readonly T[]
): T[] {
  if (typeof localStorage === 'undefined') return [...defaultOrder];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [...defaultOrder];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaultOrder];
    const valid = new Set<string>(defaultOrder);
    const filtered = parsed.filter((id): id is T => typeof id === 'string' && valid.has(id));
    for (const id of defaultOrder) {
      if (!filtered.includes(id)) filtered.push(id);
    }
    return filtered;
  } catch {
    return [...defaultOrder];
  }
}

export function saveSectionOrder(key: string, order: readonly string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    /* silent */
  }
}

export function reorderList<T>(list: readonly T[], from: T, to: T): T[] {
  const a = list.indexOf(from);
  const b = list.indexOf(to);
  if (a < 0 || b < 0 || a === b) return [...list];
  const next = [...list];
  const [moved] = next.splice(a, 1);
  next.splice(b, 0, moved);
  return next;
}

export function sectionMoveHandlers<T extends string>(
  id: T,
  order: readonly T[],
  setOrder: (next: T[]) => void
) {
  const idx = order.indexOf(id);
  const canMoveUp = idx > 0;
  const canMoveDown = idx >= 0 && idx < order.length - 1;
  return {
    canMoveUp,
    canMoveDown,
    onMoveUp: canMoveUp
      ? () => {
          const next = [...order];
          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          setOrder(next);
        }
      : undefined,
    onMoveDown: canMoveDown
      ? () => {
          const next = [...order];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          setOrder(next);
        }
      : undefined
  };
}
