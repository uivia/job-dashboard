import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPagination } from "@/lib/pagination";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const session = await getServerSession(authOptions);
  const ownerEmail = process.env.DASHBOARD_OWNER_EMAIL?.toLowerCase();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ownerEmail) redirect("/signin");

  const totalApplications = await db.jobApplication.count();
  const pagination = getPagination((await searchParams).page, totalApplications);
  const applications = await db.jobApplication.findMany({
    orderBy: [{ statusUpdatedAt: "desc" }, { id: "desc" }],
    skip: pagination.skip,
    take: pagination.pageSize
  });
  return (
    <Dashboard
      user={{ name: session.user.name ?? "John", image: session.user.image ?? null }}
      totalApplications={totalApplications}
      page={pagination.page}
      totalPages={pagination.totalPages}
      applications={applications.map((application) => ({
        id: application.id,
        title: application.title,
        company: application.company,
        techStack: application.techStack,
        status: application.status,
        statusUpdatedAt: application.statusUpdatedAt.toISOString()
      }))}
    />
  );
}

