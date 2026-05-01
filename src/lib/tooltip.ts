/**
 * Global tooltip system. A singleton element is injected into <body>.
 * Any element with [data-tooltip] triggers display on hover OR keyboard
 * focus. Position uses `position: fixed` to escape parent overflow:hidden.
 *
 * Supported attributes:
 *   - data-tooltip="text" (required)
 *   - data-tooltip-placement="top" | "bottom" (default: bottom)
 *   - data-tooltip-instant on an ancestor: show with no delay
 */

const SHOW_DELAY_MS = 350;
const HIDE_DELAY_MS = 60;
const EDGE_PADDING = 6;

export function setupGlobalTooltips(): () => void {
  if (typeof document === 'undefined') return () => {};

  const tip = document.createElement('div');
  tip.className = 'global-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  let activeTarget: HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function position(target: HTMLElement) {
    const placement = target.getAttribute('data-tooltip-placement') ?? 'bottom';
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top: number;
    if (placement === 'top') {
      top = rect.top - tipRect.height - 8;
    } else {
      top = rect.bottom + 8;
    }
    // Clamp inside the viewport.
    left = Math.max(
      EDGE_PADDING,
      Math.min(window.innerWidth - tipRect.width - EDGE_PADDING, left)
    );
    top = Math.max(
      EDGE_PADDING,
      Math.min(window.innerHeight - tipRect.height - EDGE_PADDING, top)
    );
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function show(target: HTMLElement) {
    const text = target.getAttribute('data-tooltip') ?? '';
    if (!text) return;
    tip.textContent = text;
    // Force a layout pass to measure before positioning.
    tip.style.left = '-9999px';
    tip.style.top = '-9999px';
    tip.classList.add('visible');
    requestAnimationFrame(() => {
      if (activeTarget === target) position(target);
    });
  }

  function hide() {
    activeTarget = null;
    tip.classList.remove('visible');
  }

  function activate(target: HTMLElement, instant: boolean) {
    if (target === activeTarget) return;
    clearTimers();
    activeTarget = target;
    const delay = instant || target.closest('[data-tooltip-instant]')
      ? 0
      : SHOW_DELAY_MS;
    if (delay === 0) {
      show(target);
    } else {
      showTimer = setTimeout(() => {
        if (activeTarget === target) show(target);
      }, delay);
    }
  }

  function deactivate(target: HTMLElement | null | undefined, related: Element | null) {
    if (!target || target !== activeTarget) return;
    const relatedTip = related?.closest<HTMLElement>('[data-tooltip]');
    if (relatedTip === target) return;
    clearTimers();
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
  }

  function onPointerOver(e: PointerEvent) {
    const target = (e.target as Element | null)?.closest<HTMLElement>(
      '[data-tooltip]'
    );
    if (!target) return;
    activate(target, false);
  }

  function onPointerOut(e: PointerEvent) {
    const target = (e.target as Element | null)?.closest<HTMLElement>(
      '[data-tooltip]'
    );
    deactivate(target, e.relatedTarget as Element | null);
  }

  function onFocusIn(e: FocusEvent) {
    const target = (e.target as Element | null)?.closest<HTMLElement>(
      '[data-tooltip]'
    );
    if (!target) return;
    // Keyboard focus shows the tooltip immediately so screen reader and
    // sighted keyboard users get the same affordance as mouse hover.
    // Skip programmatic focus (modal close restoring focus to its
    // trigger): :focus-visible only matches keyboard-driven focus.
    if (typeof target.matches === 'function' && !target.matches(':focus-visible')) return;
    activate(target, true);
  }

  function onFocusOut(e: FocusEvent) {
    const target = (e.target as Element | null)?.closest<HTMLElement>(
      '[data-tooltip]'
    );
    deactivate(target, e.relatedTarget as Element | null);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && activeTarget) {
      clearTimers();
      hide();
    }
  }

  function onPointerDown() {
    clearTimers();
    hide();
  }

  function onScroll() {
    if (activeTarget) position(activeTarget);
  }

  document.addEventListener('pointerover', onPointerOver);
  document.addEventListener('pointerout', onPointerOut);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);

  return () => {
    clearTimers();
    document.removeEventListener('pointerover', onPointerOver);
    document.removeEventListener('pointerout', onPointerOut);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('blur', hide);
    window.removeEventListener('resize', hide);
    tip.remove();
  };
}
