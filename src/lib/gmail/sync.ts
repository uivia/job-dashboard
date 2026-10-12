import { db } from "../db";
import type { ApplicationStatus } from "../domain";
import { getGmailMessages, listGmailMessageIds } from "./client";
import { parseJobEmail } from "./parser";
import { getAppliedDateUpdates } from "./date-recovery";
import { decideSyncEvent, mergeAppliedAt, mergeJobPostingUrl, mergeTechStack, type ExistingApplication } from "./sync-plan";

export type SyncResult = {
  added: number;
  updated: number;
  ignored: number;
  failed: number;
  requiresReconnect: boolean;
  errorMessage?: string;
  remaining: number;
};

const MAX_EMAILS_PER_SYNC = 50;

export async function syncJobEmails(accessToken: string): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, ignored: 0, failed: 0, requiresReconnect: false, remaining: 0 };
  const messageIds = await listGmailMessageIds(accessToken);
  const processed = new Set(
    (
      await db.processedEmail.findMany({
        where: { messageId: { in: messageIds } },
        select: { messageId: true }
      })
    ).map(({ messageId }) => messageId)
  );
  const pendingIds = messageIds.filter((messageId) => !processed.has(messageId));
  const missingDates = await db.jobApplication.findMany({
    where: { origin: "GMAIL", appliedAt: null },
    include: { processedEmails: { select: { messageId: true } } }
  });
  const recoveryIds = [...new Set(missingDates.flatMap((application) => application.processedEmails.map(({ messageId }) => messageId)))];
  // Share the existing Gmail request budget between date recovery and new mail.
  const recoveryBudget = Math.min(recoveryIds.length, Math.floor(MAX_EMAILS_PER_SYNC / 2));
  // Rotate batches so emails without recoverable dates cannot block later jobs.
  const batchCount = Math.max(1, Math.ceil(recoveryIds.length / Math.max(1, recoveryBudget)));
  const offset = (Math.floor(Date.now() / 60_000) % batchCount) * recoveryBudget;
  const recovery = await getGmailMessages(accessToken, recoveryIds.slice(offset, offset + recoveryBudget));
  result.failed += recovery.failed;
  for (const update of getAppliedDateUpdates(missingDates, recovery.emails)) {
    await db.jobApplication.updateMany({
      where: { id: update.id, origin: "GMAIL", appliedAt: null },
      data: { appliedAt: update.appliedAt }
    });
    result.updated++;
  }
  const fetched = await getGmailMessages(accessToken, pendingIds.slice(0, MAX_EMAILS_PER_SYNC - recoveryBudget));
  result.failed += fetched.failed;
  const emails = fetched.emails.sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
  );
  result.remaining = Math.max(0, pendingIds.length - emails.length);
  const records = await db.jobApplication.findMany({
    include: { processedEmails: { select: { threadId: true } } }
  });
  const applications: ExistingApplication[] = records.map((application) => ({
    id: application.id,
    origin: application.origin,
    title: application.title,
    company: application.company,
    techStack: application.techStack,
    status: application.status as ApplicationStatus,
    statusUpdatedAt: application.statusUpdatedAt,
    appliedAt: application.appliedAt,
    jobPostingUrl: application.jobPostingUrl,
    threadIds: application.processedEmails.flatMap(({ threadId }) => (threadId ? [threadId] : []))
  }));

  for (const email of emails) {
    if (processed.has(email.messageId)) continue;
    const event = parseJobEmail(email);
    if (!event) {
      await db.processedEmail.create({
        data: { messageId: email.messageId, threadId: email.threadId, receivedAt: email.receivedAt, outcome: "IGNORED", reasonCode: "NOT_JOB_EVENT" }
      });
      result.ignored++;
      continue;
    }

    const decision = decideSyncEvent(event, applications);
    try {
      if (decision.kind === "ADD") {
        const application = await db.jobApplication.create({
          data: {
            title: event.title,
            company: event.company,
            jobPostingUrl: event.jobPostingUrl,
            techStack: event.techStack,
            status: event.status,
            origin: "GMAIL",
            appliedAt: event.appliedAt ?? null,
            statusUpdatedAt: event.receivedAt,
            processedEmails: {
              create: {
                messageId: event.messageId,
                threadId: event.threadId,
                receivedAt: event.receivedAt,
                outcome: "ADDED",
                inferredStatus: event.status
              }
            }
          }
        });
        applications.push({
          id: application.id,
          origin: application.origin,
          title: application.title,
          company: application.company,
          techStack: application.techStack,
          status: application.status as ApplicationStatus,
          statusUpdatedAt: application.statusUpdatedAt,
          appliedAt: application.appliedAt,
          jobPostingUrl: application.jobPostingUrl,
          threadIds: event.threadId ? [event.threadId] : []
        });
        result.added++;
        continue;
      }

      if (decision.kind === "UPDATE" || decision.kind === "ENRICH") {
        const application = applications.find(({ id }) => id === decision.applicationId)!;
        const techStack = decision.kind === "UPDATE" ? mergeTechStack(application.techStack, event.techStack) : application.techStack;
        const jobPostingUrl = mergeJobPostingUrl(application.jobPostingUrl, event.jobPostingUrl);
        const appliedAt = mergeAppliedAt(application, event);
        await db.$transaction([
          db.jobApplication.update({
            where: { id: decision.applicationId },
            data: decision.kind === "UPDATE"
              ? { status: decision.status, statusUpdatedAt: event.receivedAt, techStack, jobPostingUrl, appliedAt }
              : { jobPostingUrl, appliedAt }
          }),
          db.processedEmail.create({
            data: {
              messageId: event.messageId,
              threadId: event.threadId,
              receivedAt: event.receivedAt,
              outcome: "UPDATED",
              inferredStatus: event.status,
              applicationId: decision.applicationId
            }
          })
        ]);
        if (decision.kind === "UPDATE") {
          application.status = decision.status;
          application.statusUpdatedAt = event.receivedAt;
          application.techStack = techStack;
        }
        application.jobPostingUrl = jobPostingUrl;
        application.appliedAt = appliedAt;
        if (event.threadId && !application.threadIds.includes(event.threadId)) application.threadIds.push(event.threadId);
        result.updated++;
        continue;
      }

      await db.processedEmail.create({
        data: {
          messageId: event.messageId,
          threadId: event.threadId,
          receivedAt: event.receivedAt,
          outcome: "IGNORED",
          reasonCode: decision.reason,
          inferredStatus: event.status,
          applicationId: decision.applicationId
        }
      });
      result.ignored++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
