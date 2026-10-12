"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/domain";

const options = [
  { value: null, label: "All statuses" },
  ...APPLICATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
];

export function StatusFilter({ value, disabled, onChange }: {
  value: ApplicationStatus | null;
  disabled: boolean;
  onChange: (value: ApplicationStatus | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const search = useRef({ text: "", time: 0 });
  const label = value ? STATUS_LABELS[value] : "All statuses";

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      optionRefs.current[options.findIndex((option) => option.value === value)]?.focus();
    });
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open, value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const openMenu = () => {
    search.current = { text: "", time: 0 };
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    const current = optionRefs.current.findIndex((option) => option === document.activeElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % options.length;
    else if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const time = performance.now();
      const text = (time - search.current.time < 600 ? search.current.text : "") + event.key.toLowerCase();
      search.current = { text, time };
      next = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
    } else return;
    event.preventDefault();
    if (next >= 0) optionRefs.current[next]?.focus();
  };

  return (
    <div className={`status-filter${open ? " is-open" : ""}`} ref={rootRef} onKeyDown={handleKeyDown} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        className={`status-filter-control${value ? " is-active" : ""}${open ? " is-open" : ""}`}
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-label={`Status: ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => open ? closeMenu() : openMenu()}
      >
        <svg className="filter-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
        <span className="filter-label">Status</span>
        <span className="filter-value">{label}</span>
        <svg className="filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      <div className="status-filter-menu" id={id} role="listbox" aria-label="Filter by status" aria-hidden={!open} inert={!open}>
        {options.map((option, index) => (
          <button
            key={option.value ?? "all"}
            ref={(element) => { optionRefs.current[index] = element; }}
            className="status-filter-option"
            type="button"
            role="option"
            aria-selected={option.value === value}
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              if (option.value !== value) onChange(option.value);
            }}
          >
            <span className={`filter-status-dot filter-dot-${option.value?.toLowerCase() ?? "all"}`} aria-hidden="true" />
            <span>{option.label}</span>
            {option.value === value && <svg className="filter-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}
