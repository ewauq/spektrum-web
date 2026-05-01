export function focusItem(
  container: HTMLElement | undefined,
  position: 'next' | 'prev' | 'first' | 'last'
) {
  if (!container) return;
  const items = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not(:disabled)'
    )
  );
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  const idx = active ? items.indexOf(active as HTMLButtonElement) : -1;
  let next: HTMLButtonElement;
  switch (position) {
    case 'next':
      next = items[(idx + 1 + items.length) % items.length];
      break;
    case 'prev':
      next = items[(idx - 1 + items.length) % items.length];
      break;
    case 'first':
      next = items[0];
      break;
    case 'last':
      next = items[items.length - 1];
      break;
  }
  next.focus();
}
