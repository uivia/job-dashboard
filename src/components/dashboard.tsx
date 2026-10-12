"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/domain";
import { createApplication, deleteApplication, syncGmail, updateApplication } from "@/app/actions";
import { SignOutButton } from "./auth-buttons";

type Application = {
  id: string;
  title: string;
  company: string;
  techStack: string[];
  status: ApplicationStatus;
  statusUpdatedAt: string;
};

type EditorValue = Omit<Application, "id" | "statusUpdatedAt"> & { id: string | null };

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  ASSESSMENT: "Assessment",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn"
};

const blankApplication: EditorValue = { id: null, title: "", company: "", techStack: [], status: "APPLIED" };

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

export function Dashboard({ applications, user, totalApplications, page, totalPages }: {
  applications: Application[];
  user: { name: string; image: string | null };
  totalApplications: number;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editor, setEditor] = useState<EditorValue | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

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
          `${result.added} added Â· ${result.updated} updated Â· ${result.ignored} ignored${
            result.failed ? ` Â· ${result.failed} failed` : ""
          }${result.remaining ? ` Â· ${result.remaining} remaining; sync again after one minute` : ""}`
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
            <button className="secondary-button" type="button" onClick={handleSync} disabled={isPending}>{isPending ? "Workingâ€¦" : "Sync Gmail"}</button>
            <button className="primary-button" type="button" onClick={() => setEditor(blankApplication)}>Add job</button>
          </div>
        </div>

        {message && <div className="notice" role="status">{message}</div>}

        <section className="applications-panel" aria-label="Job applications">
          <div className="panel-heading"><h2>Applications</h2><span>{totalApplications} total</span></div>
          {applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">â†—</div>
              <h2>No applications yet</h2>
              <p>Sync Gmail to import recent applications, or add one manually.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap desktop-only">
                <table>
                  <thead><tr><th>Job title</th><th>Company</th><th>Tech stack</th><th>Status</th></tr></thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td><button className="job-link" onClick={() => setEditor({ ...application })}>{application.title}</button></td>
                        <td>{application.company}</td>
                        <td><TechStack technologies={application.techStack} /></td>
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
                    <TechStack technologies={application.techStack} />
                    <StatusSelect application={application} onChange={(status) => changeStatus(application, status)} disabled={isPending} />
                  </article>
                ))}
              </div>
              <nav className="pagination" aria-label="Application pages">
                <span>Page {page} of {totalPages}</span>
                <div className="pagination-actions">
                  {page > 1
                    ? <Link className="secondary-button" href={page === 2 ? "/" : `/?page=${page - 1}`}>Previous</Link>
                    : <span className="secondary-button pagination-disabled" aria-disabled="true">Previous</span>}
                  {page < totalPages
                    ? <Link className="secondary-button" href={`/?page=${page + 1}`}>Next</Link>
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
              <button className="close-button" type="button" aria-label="Close" onClick={() => setEditor(null)}>Ã—</button>
            </div>
            <label>Job title<input name="title" defaultValue={editor.title} required autoFocus /></label>
            <label>Company<input name="company" defaultValue={editor.company} required /></label>
            <label>Tech stack<input name="techStack" defaultValue={editor.techStack.join(", ")} placeholder="Python, React, PostgreSQL" /></label>
            <label>Status<select name="status" defaultValue={editor.status}>{APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
            <div className="dialog-actions">
              {editor.id && <button className="danger-button" type="button" onClick={removeApplication} disabled={isPending}>Delete</button>}
              <span />
              <button className="secondary-button" type="button" onClick={() => setEditor(null)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isPending}>{isPending ? "Savingâ€¦" : "Save"}</button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
