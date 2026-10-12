import { extractAppliedAt, type JobEmail } from "./parser.ts";

type RecoveryApplication = {
  id: string;
  origin: string;
  appliedAt: Date | null;
  processedEmails: Array<{ messageId: string }>;
};

export function getAppliedDateUpdates(applications: RecoveryApplication[], emails: JobEmail[]) {
  const dates = new Map(emails.map((email) => [email.messageId, extractAppliedAt(email)]));
  return applications.flatMap((application) => {
    if (application.origin !== "GMAIL" || application.appliedAt !== null) return [];
    const candidates = application.processedEmails.flatMap(({ messageId }) => {
      const date = dates.get(messageId);
      return date ? [date] : [];
    });
    if (!candidates.length) return [];
    return [{ id: application.id, appliedAt: new Date(Math.min(...candidates.map((date) => date.getTime()))) }];
  });
}
