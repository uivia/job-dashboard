import { APPLICATION_STATUSES, type ApplicationStatus, type JobApplicationInput } from "./domain.ts";

type RawApplicationInput = {
  title?: unknown;
  company?: unknown;
  techStack?: unknown;
  status?: unknown;
};

function requiredText(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}

export function parseApplicationInput(input: RawApplicationInput): JobApplicationInput {
  const title = requiredText(input.title, "Job title is required");
  const company = requiredText(input.company, "Company is required");
  if (typeof input.status !== "string" || !APPLICATION_STATUSES.includes(input.status as ApplicationStatus)) {
    throw new Error("Invalid application status");
  }

  const seen = new Set<string>();
  const techStack = (typeof input.techStack === "string" ? input.techStack.split(",") : [])
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { title, company, techStack, status: input.status as ApplicationStatus };
}
