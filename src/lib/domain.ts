export const APPLICATION_STATUSES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "ASSESSMENT",
  "OFFER",
  "REJECTED",
  "WITHDRAWN"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type JobApplicationInput = {
  title: string;
  company: string;
  techStack: string[];
  status: ApplicationStatus;
};

export type ParsedJobEvent = JobApplicationInput & {
  messageId: string;
  threadId: string | null;
  receivedAt: Date;
};

