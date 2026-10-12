import type { ApplicationStatus, JobApplicationInput } from "./domain";

export function applicationUpdateData(
  currentStatus: ApplicationStatus,
  input: JobApplicationInput,
  now = new Date()
): JobApplicationInput & { statusUpdatedAt?: Date } {
  return currentStatus === input.status ? input : { ...input, statusUpdatedAt: now };
}
