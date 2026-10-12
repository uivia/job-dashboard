import { extractJobPostingUrl, type JobEmail } from "./parser.ts";

type RecoveryApplication = {
  id: string;
  origin: string;
  title: string;
  jobPostingUrl: string | null;
  processedEmails: Array<{ messageId: string }>;
};

export function getJobPostingUrlUpdates(applications: RecoveryApplication[], emails: JobEmail[]): Array<{ id: string; jobPostingUrl: string }> {
  const byId = new Map(emails.map((email) => [email.messageId, email]));
  return applications.flatMap((application) => {
    if (application.origin !== "GMAIL" || application.jobPostingUrl !== null) return [];
    const sources = application.processedEmails.flatMap(({ messageId }) => {
      const email = byId.get(messageId);
      return email ? [email] : [];
    }).sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    for (const email of sources) {
      const jobPostingUrl = extractJobPostingUrl(email, application.title);
      if (jobPostingUrl) return [{ id: application.id, jobPostingUrl }];
    }
    return [];
  });
}
