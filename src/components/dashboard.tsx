"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/domain";
import { PAGE_SIZES } from "@/lib/pagination";
import { formatAppliedDate } from "@/lib/applied-date";
import { createApplication, deleteApplication, syncGmail, updateApplication } from "@/app/actions";
import { SignOutButton } from "./auth-buttons";

type Application = {
  id: string;
  title: string;
  company: string;
  jobPostingUrl: string | null;
  techStack: string[];
  status: ApplicationStatus;
  statusUpdatedAt: string;
  appliedAt: string | null;
};

type EditorValue = Omit<Application, "id" | "statusUpdatedAt" | "appliedAt"> & { id: string | null };

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  ASSESSMENT: "Assessment",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn"
};

const blankApplication: EditorValue = { id: null, title: "", company: "", jobPostingUrl: null, techStack: [], status: "APPLIED" };

function StatusSelect({ application, onChange, disabled }: { application: Application; onChange: (status: ApplicationStatus) => void; disabled: boolean }) {
  return (
    <select
      className={`status-select status-${application.status.toLowerCase()}`}
      aria-label={`Status for ${application.title} at ${application.company}`}
      value={application.status}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ApplicationStatus)}
    >
      {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
    </select>
  );
}

function TechStack({ technologies }: { technologies: string[] }) {
  if (!technologies.length) return <span className="muted">Not specified</span>;
  return <div className="tag-list">{technologies.map((technology) => <span className="tag" key={technology}>{technology}</span>)}</div>;
}

function AppliedDate({ appliedAt, now }: { appliedAt: string | null; now: Date }) {
  const date = formatAppliedDate(appliedAt, now);
  if (!date) return <span className="muted">Unknown</span>;
  return (
    <time className="applied-date" dateTime={appliedAt!} tabIndex={0} aria-label={`Date applied: ${date.exact}`}>
      {date.relative}
      <span className="date-tooltip" aria-hidden="true">{date.exact}</span>
    </time>
  );
}

export function Dashboard({ applications, user, totalApplications, page, pageSize, totalPages, referenceTime }: {
  applications: Application[];
  user: { name: string; image: string | null };
  totalApplications: number;
  page: number;
  pageSize: number;
  totalPages: number;
  referenceTime: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    if (editor) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [editor]);

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
      setEditor(null);
      setMessage(editor.id ? "Application updated." : "Application added.");
    });
  };

  const removeApplication = () => {
    if (!editor?.id || !window.confirm("Delete this application?")) return;
    run(async () => {
      await deleteApplication(editor.id!);
      setEditor(null);
      setMessage("Application deleted.");
    });
  };

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small">J</span><span>Job Dashboard</span></div>
        <div className="account">
          {user.image ? <img src={user.image} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{user.name.charAt(0)}</span>}
          <SignOutButton />
        </div>
      </header>

      <section className="dashboard-content">
        <div className="hero-row">
          <div>
            <p className="eyebrow">APPLICATION TRACKER</p>
            <h1>Jobs applied</h1>            
          </div>
          <div className="hero-actions">
            <button className="secondary-button" type="button" onClick={handleSync} disabled={isPending}>{isPending ? "Working…" : "Sync Gmail"}</button>
            <button className="primary-button" type="button" onClick={() => setEditor(blankApplication)}>Add job</button>
          </div>
        </div>

        {message && <div className="notice" role="status">{message}</div>}

        <section className="applications-panel" aria-label="Job applications">
          <div className="panel-heading"><h2>Applications</h2><span>{totalApplications} total · Latest applied first</span></div>
          {applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">↗</div>
              <h2>No applications yet</h2>
              <p>Sync Gmail to import recent applications, or add one manually.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap desktop-only">
                <table>
                  <thead><tr><th>Job title</th><th>Company</th><th>Tech stack</th><th>Job Posting URL</th><th>Date Applied</th><th>Status</th></tr></thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td><button className="job-link" onClick={() => setEditor({ ...application })}>{application.title}</button></td>
                        <td>{application.company}</td>
                        <td><TechStack technologies={application.techStack} /></td>
                        <td>{application.jobPostingUrl
                          ? <a className="posting-link" href={application.jobPostingUrl} target="_blank" rel="noopener noreferrer">View job posting</a>
                          : <span className="muted">—</span>}</td>
                        <td><AppliedDate appliedAt={application.appliedAt} now={now} /></td>
                        <td><StatusSelect application={application} onChange={(status) => changeStatus(application, status)} disabled={isPending} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-list mobile-only">
                {applications.map((application) => (
                  <article className="application-card" key={application.id}>
                    <button className="job-link" onClick={() => setEditor({ ...application })}>{application.title}</button>
                    <p>{application.company}</p>
                    {application.jobPostingUrl
                      ? <a className="posting-link" href={application.jobPostingUrl} target="_blank" rel="noopener noreferrer">View job posting</a>
                      : <span className="muted">—</span>}
                    <TechStack technologies={application.techStack} />
                    <div className="application-date"><span className="muted">Date Applied: </span><AppliedDate appliedAt={application.appliedAt} now={now} /></div>
                    <StatusSelect application={application} onChange={(status) => changeStatus(application, status)} disabled={isPending} />
                  </article>
                ))}
              </div>
              <nav className="pagination" aria-label="Application pages">
                <label className="page-size-control">
                  Records per page
                  <select value={pageSize} onChange={(event) => router.push(`/?pageSize=${event.target.value}`)} disabled={isPending}>
                    {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <span>Page {page} of {totalPages}</span>
                <div className="pagination-actions">
                  {page > 1
                    ? <Link className="secondary-button" href={page === 2 ? `/?pageSize=${pageSize}` : `/?page=${page - 1}&pageSize=${pageSize}`}>Previous</Link>
                    : <span className="secondary-button pagination-disabled" aria-disabled="true">Previous</span>}
                  {page < totalPages
                    ? <Link className="secondary-button" href={`/?page=${page + 1}&pageSize=${pageSize}`}>Next</Link>
                    : <span className="secondary-button pagination-disabled" aria-disabled="true">Next</span>}
                </div>
              </nav>
            </>
          )}
        </section>
      </section>

      <dialog ref={dialogRef} className="editor-dialog" onCancel={() => setEditor(null)}>
        {editor && (
          <form action={saveEditor}>
            <div className="dialog-heading">
              <div><p className="eyebrow">{editor.id ? "EDIT APPLICATION" : "NEW APPLICATION"}</p><h2>{editor.id ? editor.title : "Add a job"}</h2></div>
              <button className="close-button" type="button" aria-label="Close" onClick={() => setEditor(null)}>×</button>
            </div>
            <label>Job title<input name="title" defaultValue={editor.title} required autoFocus /></label>
            <label>Company<input name="company" defaultValue={editor.company} required /></label>
            <label>Job posting URL<input name="jobPostingUrl" type="url" defaultValue={editor.jobPostingUrl ?? ""} placeholder="https://example.com/jobs/123" /></label>
            <label>Tech stack<input name="techStack" defaultValue={editor.techStack.join(", ")} placeholder="Python, React, PostgreSQL" /></label>
            <label>Status<select name="status" defaultValue={editor.status}>{APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
            <div className="dialog-actions">
              {editor.id && <button className="danger-button" type="button" onClick={removeApplication} disabled={isPending}>Delete</button>}
              <span />
              <button className="secondary-button" type="button" onClick={() => setEditor(null)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
