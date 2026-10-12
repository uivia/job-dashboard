import { db } from "../db";
import type { ApplicationStatus } from "../domain";
import { getGmailMessages, listGmailMessageIds } from "./client";
import { parseJobEmail } from "./parser";
import { decideSyncEvent, mergeJobPostingUrl, mergeTechStack, type ExistingApplication } from "./sync-plan";

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
  const emails = (await getGmailMessages(accessToken, pendingIds.slice(0, MAX_EMAILS_PER_SYNC))).sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
  );
  result.remaining = Math.max(0, pendingIds.length - emails.length);
  const records = await db.jobApplication.findMany({
    include: { processedEmails: { select: { threadId: true } } }
  });
  const applications: ExistingApplication[] = records.map((application) => ({
    id: application.id,
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
            appliedAt: event.status === "APPLIED" ? event.receivedAt : null,
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
        await db.$transaction([
          db.jobApplication.update({
            where: { id: decision.applicationId },
            data: decision.kind === "UPDATE"
              ? { status: decision.status, statusUpdatedAt: event.receivedAt, techStack, jobPostingUrl }
              : { jobPostingUrl }
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
