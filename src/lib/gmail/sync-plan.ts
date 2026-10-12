import type { ApplicationStatus, ParsedJobEvent } from "../domain";

export type ExistingApplication = {
  id: string;
  origin: "GMAIL" | "MANUAL";
  title: string;
  company: string;
  techStack: string[];
  status: ApplicationStatus;
  statusUpdatedAt: Date;
  appliedAt: Date | null;
  jobPostingUrl: string | null;
  threadIds: string[];
};

export function mergeTechStack(current: string[], incoming: string[]): string[] {
  return current.length ? current : incoming;
}

export function mergeJobPostingUrl(current: string | null, incoming: string | null): string | null {
  return current ?? incoming;
}

export function mergeAppliedAt(application: Pick<ExistingApplication, "origin" | "appliedAt">, event: ParsedJobEvent): Date | null {
  const appliedAt = event.appliedAt !== undefined ? event.appliedAt : (event.status === "APPLIED" ? event.receivedAt : null);
  if (application.origin === "GMAIL" && appliedAt &&
      (application.appliedAt === null || appliedAt < application.appliedAt)) {
    return appliedAt;
  }
  return application.appliedAt;
}

export type SyncDecision =
  | { kind: "ADD" }
  | { kind: "UPDATE"; applicationId: string; status: ApplicationStatus }
  | { kind: "ENRICH"; applicationId: string }
  | { kind: "IGNORE"; applicationId?: string; reason: "AMBIGUOUS_MATCH" | "MISSING_IDENTITY" | "STALE_STATUS" };

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

export function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function decisionForMatch(event: ParsedJobEvent, application: ExistingApplication): SyncDecision {
  if (event.receivedAt < application.statusUpdatedAt) {
    if ((!application.jobPostingUrl && event.jobPostingUrl) || mergeAppliedAt(application, event) !== application.appliedAt) {
      return { kind: "ENRICH", applicationId: application.id };
    }
    return { kind: "IGNORE", applicationId: application.id, reason: "STALE_STATUS" };
  }
  return {
    kind: "UPDATE",
    applicationId: application.id,
    status: event.status === "APPLIED" && application.status !== "APPLIED" ? application.status : event.status
  };
}

export function decideSyncEvent(event: ParsedJobEvent, applications: ExistingApplication[]): SyncDecision {
  if (event.threadId) {
    const threadMatch = applications.find((application) => application.threadIds.includes(event.threadId!));
    if (threadMatch) return decisionForMatch(event, threadMatch);
  }

  if (!event.title || !event.company) return { kind: "IGNORE", reason: "MISSING_IDENTITY" };

  const title = normalizeIdentity(event.title);
  const company = normalizeIdentity(event.company);
  const matches = applications.filter(
    (application) => normalizeIdentity(application.title) === title && normalizeIdentity(application.company) === company
  );

  if (matches.length > 1) return { kind: "IGNORE", reason: "AMBIGUOUS_MATCH" };
  if (matches.length === 1) {
    const match = matches[0];
    const isRecentAcknowledgement =
      event.status === "APPLIED" &&
      match.appliedAt !== null &&
      Math.abs(event.receivedAt.getTime() - match.appliedAt.getTime()) <= FOURTEEN_DAYS;

    if (event.status !== "APPLIED" || match.appliedAt === null || isRecentAcknowledgement) return decisionForMatch(event, match);
  }

  return { kind: "ADD" };
}
