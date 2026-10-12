import { APPLICATION_STATUSES, type ApplicationStatus } from "./domain.ts";

export function parseStatusFilter(rawStatus: string | string[] | undefined): ApplicationStatus | null {
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  return APPLICATION_STATUSES.includes(status as ApplicationStatus) ? status as ApplicationStatus : null;
}

export function applicationListHref({ status, pageSize, page = 1 }: {
  status: ApplicationStatus | null;
  pageSize: number;
  page?: number;
}): string {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/?${params}`;
}
