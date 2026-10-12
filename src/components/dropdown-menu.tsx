"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { getNextTabStop } from "@/lib/dropdown-focus";
import { getDropdownPosition } from "@/lib/dropdown-position";

export type DropdownOption = { value: string; label: string; marker?: ReactNode };

export function DropdownMenu({
  ariaLabel,
  triggerLabel,
  triggerContent,
  value,
  options,
  onChange,
  triggerClassName,
  rootClassName,
  disabled = false
}: {
  ariaLabel: string;
  triggerLabel: string;
  triggerContent: ReactNode;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  triggerClassName: string;
  rootClassName?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const search = useRef({ text: "", time: 0 });
  const [phase, setPhase] = useState<"opening" | "open" | "closing" | null>(null);
  const [position, setPosition] = useState<CSSProperties>();

  const finishClose = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    closingRef.current = false;
    setPhase(null);
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    if (!phase || closingRef.current) return;
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }
    closingRef.current = true;
    setPhase("closing");
    timerRef.current = window.setTimeout(finishClose, 180);
  }, [finishClose, phase]);

  const openMenu = () => {
    if (disabled) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    closingRef.current = false;
    search.current = { text: "", time: 0 };
    setPhase("opening");
  };

  useEffect(() => {
    if (phase !== "opening") return;
    const frame = window.requestAnimationFrame(() => {
      setPhase("open");
      const index = options.findIndex((option) => option.value === value);
      const active = optionRefs.current[index];
      active?.focus({ preventScroll: true });
      active?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [options, phase, value]);

  useLayoutEffect(() => {
    if (phase !== "opening" && phase !== "open") return;
    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const next = getDropdownPosition(anchor, menu.getBoundingClientRect().height, window.innerWidth, window.innerHeight);
      setPosition({ left: next.left, top: next.top, width: next.width, maxHeight: next.maxHeight });
      menu.dataset.placement = next.placement;
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [phase]);

  useEffect(() => {
    if (!phase || phase === "closing") return;
    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [closeMenu, phase]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (disabled && phase && phase !== "closing") closeMenu();
  }, [closeMenu, disabled, phase]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!phase) {
      if (event.target === triggerRef.current && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.getClientRects().length > 0);
      const next = getNextTabStop(focusable, triggerRef.current!, event.shiftKey);
      closeMenu();
      next?.focus();
      if (next) event.preventDefault();
      return;
    }

    const current = optionRefs.current.findIndex((option) => option === document.activeElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % options.length;
    else if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent.isComposing) {
      const time = performance.now();
      const text = (time - search.current.time < 600 ? search.current.text : "") + event.key.toLowerCase();
      search.current = { text, time };
      next = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
    } else return;

    event.preventDefault();
    const active = optionRefs.current[next];
    active?.focus();
    active?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div ref={rootRef} className={`dropdown-root ${rootClassName ?? ""}`} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        className={triggerClassName}
        type="button"
        disabled={disabled}
        aria-label={triggerLabel}
        aria-haspopup="listbox"
        aria-expanded={phase === "opening" || phase === "open"}
        aria-controls={phase ? `${id}-listbox` : undefined}
        onClick={() => phase === "open" || phase === "opening" ? closeMenu(true) : openMenu()}
      >
        {triggerContent}
      </button>
      {phase && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="dropdown-menu"
          id={`${id}-listbox`}
          role="listbox"
          aria-label={ariaLabel}
          aria-hidden={phase === "closing"}
          inert={phase === "closing"}
          data-state={phase}
          style={position}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && phase === "closing" && event.propertyName === "transform") finishClose();
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              className="dropdown-option"
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              onClick={() => {
                closeMenu(true);
                if (option.value !== value) onChange(option.value);
              }}
            >
              {option.marker}
              <span>{option.label}</span>
              {option.value === value && <svg className="dropdown-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
