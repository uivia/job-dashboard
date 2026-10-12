import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPagination } from "@/lib/pagination";
import { parseStatusFilter } from "@/lib/status-filter";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; status?: string | string[] }> }) {
  const session = await getServerSession(authOptions);
  const ownerEmail = process.env.DASHBOARD_OWNER_EMAIL?.toLowerCase();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ownerEmail) redirect("/signin");

  const now = new Date();
  const params = await searchParams;
  const statusFilter = parseStatusFilter(params.status);
  const where = statusFilter ? { status: statusFilter } : {};
  const totalApplications = await db.jobApplication.count({ where });
  const pagination = getPagination(params.page, totalApplications, params.pageSize);
  const applications = await db.jobApplication.findMany({
    where,
    orderBy: [{ appliedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    skip: pagination.skip,
    take: pagination.pageSize
  });
  return (
    <Dashboard
      user={{ name: session.user.name ?? "John", image: session.user.image ?? null }}
      totalApplications={totalApplications}
      statusFilter={statusFilter}
      page={pagination.page}
      pageSize={pagination.pageSize}
      totalPages={pagination.totalPages}
      referenceTime={now.toISOString()}
      applications={applications.map((application) => ({
        id: application.id,
        title: application.title,
        company: application.company,
        jobPostingUrl: application.jobPostingUrl,
        techStack: application.techStack,
        status: application.status,
        appliedAt: application.appliedAt?.toISOString() ?? null,
        updatedAt: application.updatedAt.toISOString(),
        statusUpdatedAt: application.statusUpdatedAt.toISOString()
      }))}
    />
  );
}

