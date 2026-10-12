"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/domain";
import { PAGE_SIZES } from "@/lib/pagination";
import { applicationListHref } from "@/lib/status-filter";
import { formatAppliedDate } from "@/lib/applied-date";
import { createApplication, deleteApplication, syncGmail, updateApplication } from "@/app/actions";
import { SignOutButton } from "./auth-buttons";
import { DropdownMenu, type DropdownOption } from "./dropdown-menu";
import { StatusFilter } from "./status-filter";

type Application = {
  id: string;
  title: string;
  company: string;
  jobPostingUrl: string | null;
  techStack: string[];
  status: ApplicationStatus;
  statusUpdatedAt: string;
  appliedAt: string | null;
  updatedAt: string;
};

type EditorValue = Omit<Application, "id" | "statusUpdatedAt" | "appliedAt" | "updatedAt"> & { id: string | null };

const blankApplication: EditorValue = { id: null, title: "", company: "", jobPostingUrl: null, techStack: [], status: "APPLIED" };

const statusOptions: DropdownOption[] = APPLICATION_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status]
}));

function StatusSelect({ application, onChange, disabled }: { application: Application; onChange: (status: ApplicationStatus) => void; disabled: boolean }) {
  return (
    <DropdownMenu
      ariaLabel={`Update status for ${application.title} at ${application.company}`}
      triggerLabel={`Status for ${application.title} at ${application.company}`}
      triggerContent={
        <>
          <span>{STATUS_LABELS[application.status]}</span>
          <svg className="status-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </>
      }
      value={application.status}
      options={statusOptions}
      onChange={(status) => onChange(status as ApplicationStatus)}
      triggerClassName={`status-select status-${application.status.toLowerCase()}`}
      disabled={disabled}
    />
  );
}

function TechStack({ technologies }: { technologies: string[] }) {
  if (!technologies.length) return <span className="muted">Not specified</span>;
  return <div className="tag-list">{technologies.map((technology) => <span className="tag" key={technology}>{technology}</span>)}</div>;
}

function CompanyName({ name }: { name: string }) {
  return (
    <div className="company-identity">
      <span className="company-mark" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
      <span className="company-name">{name}</span>
    </div>
  );
}

function ApplicationDate({ timestamp, label, now, variant = "applied" }: { timestamp: string | null; label: string; now: Date; variant?: "applied" | "updated" }) {
  const date = formatAppliedDate(timestamp, now);
  if (!date) return <span className="date-badge date-unknown">Unknown</span>;
  return (
    <time className={`applied-date date-badge date-${variant}`} dateTime={timestamp!} tabIndex={0} aria-label={`${label}: ${date.exact}`}>
      {date.relative}
      <span className="date-tooltip" aria-hidden="true">{date.exact}</span>
    </time>
  );
}

export function Dashboard({ applications, user, totalApplications, statusFilter, page, pageSize, totalPages, referenceTime }: {
  applications: Application[];
  user: { name: string; image: string | null };
  totalApplications: number;
  statusFilter: ApplicationStatus | null;
  page: number;
  pageSize: number;
  totalPages: number;
  referenceTime: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const finishCloseRef = useRef<(() => void) | null>(null);
  const [editor, setEditor] = useState<EditorValue | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date(referenceTime));

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!editor || !dialog || dialog.open) return;
    dialog.dataset.state = "opening";
    dialog.showModal();
    const frame = window.requestAnimationFrame(() => { dialog.dataset.state = "open"; });
    return () => window.cancelAnimationFrame(frame);
  }, [editor]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const openEditor = (value: EditorValue, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setEditor(value);
  };

  const closeEditor = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.dataset.state === "closing") return;
    dialog.dataset.state = "closing";
    const finish = () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      finishCloseRef.current = null;
      if (!dialog.open) return;
      dialog.close();
      setEditor(null);
      const returnFocus = returnFocusRef.current?.isConnected ? returnFocusRef.current : addButtonRef.current;
      returnFocus?.focus({ preventScroll: true });
    };
    finishCloseRef.current = finish;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else closeTimerRef.current = window.setTimeout(finish, 180);
  };

  const run = (operation: () => Promise<void>) => {
    setMessage("");
    startTransition(async () => {
      try {
        await operation();
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      }
    });
  };

  const changeStatus = (application: Application, status: ApplicationStatus) => {
    run(() => updateApplication(application.id, {
      title: application.title,
      company: application.company,
      jobPostingUrl: application.jobPostingUrl ?? "",
      techStack: application.techStack.join(", "),
      status
    }));
  };

  const handleSync = () => {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await syncGmail();
        if (result.errorMessage) {
          setMessage(result.errorMessage);
          return;
        }
        if (result.requiresReconnect) {
          setMessage("Gmail access needs to be renewed. Sign out, then sign in again.");
          return;
        }
        setMessage(
          `${result.added} added · ${result.updated} updated · ${result.ignored} ignored${
            result.failed ? ` · ${result.failed} failed` : ""
          }${result.remaining ? ` · ${result.remaining} remaining; sync again after one minute` : ""}`
        );
        router.refresh();
      } catch {
        setMessage("Gmail sync stopped early. The latest saved applications are shown; you can safely retry.");
        router.refresh();
      }
    });
  };

  const saveEditor = (formData: FormData) => {
    if (!editor) return;
    const input = {
      title: String(formData.get("title") ?? ""),
      company: String(formData.get("company") ?? ""),
      jobPostingUrl: String(formData.get("jobPostingUrl") ?? ""),
      techStack: String(formData.get("techStack") ?? ""),
      status: String(formData.get("status") ?? "APPLIED")
    };
    run(async () => {
      if (editor.id) await updateApplication(editor.id, input);
      else await createApplication(input);
      closeEditor();
      setMessage(editor.id ? "Application updated." : "Application added.");
    });
  };

  const removeApplication = () => {
    if (!editor?.id || !window.confirm("Delete this application?")) return;
    run(async () => {
      await deleteApplication(editor.id!);
      closeEditor();
      setMessage("Application deleted.");
    });
  };

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small" aria-hidden="true">{user.name.charAt(0) || "J"}<span className="brand-dot" /></span><span>Role log</span></div>
        <div className="account">
          {user.image ? <img src={user.image} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{user.name.charAt(0)}</span>}
          <SignOutButton />
        </div>
      </header>

      <section className="dashboard-content">
        <div className="hero-row">
          <div>
            <p className="eyebrow">{user.name.split(" ")[0] || "My"}{user.name ? "’s" : ""} workspace</p>
            <h1>My job search<span className="heading-dot">.</span></h1>
          </div>
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={handleSync} disabled={isPending}>{isPending ? "Working…" : "Sync Gmail"}</button>
            <button ref={addButtonRef} className="primary-button" type="button" onClick={(event) => openEditor(blankApplication, event.currentTarget)}>Add job</button>
          </div>
        </div>

        <div className={`notice-shell${message ? " is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true"><div className="notice">{message}</div></div>

        <section aria-label="Job applications">
          <div className="applications-toolbar">
            <div className="applications-summary">
              <div className="applications-title">
                <h2>Application log</h2>
                <span className="application-count" aria-label={`${totalApplications} ${statusFilter ? "matching" : "total"} applications`}>{totalApplications}</span>
              </div>
              <p>{statusFilter ? `${STATUS_LABELS[statusFilter]} applications` : "All your applications"} <span aria-hidden="true">·</span> Latest applied first</p>
            </div>
            <StatusFilter value={statusFilter} disabled={isPending} onChange={(status) => {
              startTransition(() => router.push(applicationListHref({ status, pageSize })));
            }} />
          </div>
          <div className="applications-panel">
          {applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">↗</div>
              <h2>{statusFilter ? "No applications with this status" : "No applications yet"}</h2>
              {statusFilter
                ? <p><Link className="posting-link" href={applicationListHref({ status: null, pageSize })}>Clear filter</Link> to see all applications.</p>
                : <p>Sync Gmail to import recent applications, or add one manually.</p>}
            </div>
          ) : (
            <>
              <div className="table-wrap desktop-only">
                <table>
                  <thead><tr><th>Job title</th><th>Company</th><th>Tech stack</th><th>Posting</th><th>Date applied</th><th>Updated at</th><th>Status</th></tr></thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td><button className="job-link" onClick={(event) => openEditor({ ...application }, event.currentTarget)}>{application.title}</button></td>
                        <td><CompanyName name={application.company} /></td>
                        <td><TechStack technologies={application.techStack} /></td>
                        <td>{application.jobPostingUrl
                          ? <a className="posting-link" href={application.jobPostingUrl} target="_blank" rel="noopener noreferrer" aria-label={`View job posting for ${application.title} at ${application.company}`}>View <span aria-hidden="true">↗</span></a>
                          : <span className="muted">—</span>}</td>
                        <td><ApplicationDate timestamp={application.appliedAt} label="Date applied" now={now} /></td>
                        <td><ApplicationDate timestamp={application.updatedAt} label="Updated at" now={now} variant="updated" /></td>
                        <td><StatusSelect application={application} onChange={(status) => changeStatus(application, status)} disabled={isPending} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-list mobile-only">
                {applications.map((application) => (
                  <article className="application-card" key={application.id}>
                    <button className="job-link" onClick={(event) => openEditor({ ...application }, event.currentTarget)}>{application.title}</button>
                    <CompanyName name={application.company} />
                    <TechStack technologies={application.techStack} />
                    {application.jobPostingUrl && <a className="posting-link" href={application.jobPostingUrl} target="_blank" rel="noopener noreferrer" aria-label={`View job posting for ${application.title} at ${application.company}`}>View posting <span aria-hidden="true">↗</span></a>}
                    <div className="application-dates">
                      <div className="application-date"><span className="date-label">Applied</span><ApplicationDate timestamp={application.appliedAt} label="Date applied" now={now} /></div>
                      <div className="application-date"><span className="date-label">Updated</span><ApplicationDate timestamp={application.updatedAt} label="Updated at" now={now} variant="updated" /></div>
                    </div>
                    <StatusSelect application={application} onChange={(status) => changeStatus(application, status)} disabled={isPending} />
                  </article>
                ))}
              </div>
              <nav className="pagination" aria-label="Application pages">
                <div className="page-size-control">
                  <span>Records per page</span>
                  <DropdownMenu
                    ariaLabel="Records per page"
                    triggerLabel={`Records per page: ${pageSize}`}
                    triggerContent={<><span>{pageSize}</span><svg className="page-size-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></>}
                    value={String(pageSize)}
                    options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
                    onChange={(selected) => {
                      const size = Number(selected);
                      startTransition(() => router.push(applicationListHref({ status: statusFilter, pageSize: size })));
                    }}
                    rootClassName="page-size-menu"
                    triggerClassName="page-size-trigger"
                    disabled={isPending}
                  />
                </div>
                <span>Page {page} of {totalPages}</span>
                <div className="pagination-actions">
                  {page > 1
                    ? <Link className="secondary-button" href={applicationListHref({ status: statusFilter, pageSize, page: page - 1 })}>Previous</Link>
                    : <span className="secondary-button pagination-disabled" aria-disabled="true">Previous</span>}
                  {page < totalPages
                    ? <Link className="secondary-button" href={applicationListHref({ status: statusFilter, pageSize, page: page + 1 })}>Next</Link>
                    : <span className="secondary-button pagination-disabled" aria-disabled="true">Next</span>}
                </div>
              </nav>
            </>
          )}
          </div>
        </section>
      </section>

      <dialog ref={dialogRef} className="editor-dialog" onCancel={(event) => { event.preventDefault(); closeEditor(); }} onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "dialog-out") finishCloseRef.current?.();
      }}>
        {editor && (
          <form action={saveEditor}>
            <div className="dialog-heading">
              <div><p className="eyebrow">{editor.id ? "EDIT APPLICATION" : "NEW APPLICATION"}</p><h2>{editor.id ? editor.title : "Add a job"}</h2></div>
              <button className="close-button" type="button" aria-label="Close" onClick={closeEditor}>×</button>
            </div>
            <label>Job title<input name="title" defaultValue={editor.title} required autoFocus /></label>
            <label>Company<input name="company" defaultValue={editor.company} required /></label>
            <label>Job posting URL<input name="jobPostingUrl" type="url" defaultValue={editor.jobPostingUrl ?? ""} placeholder="https://example.com/jobs/123" /></label>
            <label>Tech stack<input name="techStack" defaultValue={editor.techStack.join(", ")} placeholder="Python, React, PostgreSQL" /></label>
            <label>Status<select name="status" defaultValue={editor.status}>{APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
            <div className="dialog-actions">
              {editor.id && <button className="danger-button" type="button" onClick={removeApplication} disabled={isPending}>Delete</button>}
              <span />
              <button className="secondary-button" type="button" onClick={closeEditor}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
