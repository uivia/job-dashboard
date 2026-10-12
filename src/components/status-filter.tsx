"use client";

import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/domain";
import { DropdownMenu, type DropdownOption } from "./dropdown-menu";

const options: DropdownOption[] = [
  { value: "ALL", label: "All statuses", marker: <span className="filter-status-dot filter-dot-all" aria-hidden="true" /> },
  ...APPLICATION_STATUSES.map((value) => ({
    value,
    label: STATUS_LABELS[value],
    marker: <span className={`filter-status-dot filter-dot-${value.toLowerCase()}`} aria-hidden="true" />
  }))
];

export function StatusFilter({ value, disabled, onChange }: {
  value: ApplicationStatus | null;
  disabled: boolean;
  onChange: (value: ApplicationStatus | null) => void;
}) {
  const selectedValue = value ?? "ALL";
  const label = value ? STATUS_LABELS[value] : "All statuses";

  return (
    <DropdownMenu
      ariaLabel="Filter by status"
      triggerLabel={`Status: ${label}`}
      triggerContent={
        <>
          <svg className="filter-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
          <span className="filter-label">Status</span>
          <span className="filter-value">{label}</span>
          <svg className="filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </>
      }
      value={selectedValue}
      options={options}
      onChange={(selected) => onChange(selected === "ALL" ? null : selected as ApplicationStatus)}
      rootClassName="status-filter"
      triggerClassName={`status-filter-control${value ? " is-active" : ""}`}
      disabled={disabled}
    />
  );
}
