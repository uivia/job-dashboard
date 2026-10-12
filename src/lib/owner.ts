import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function requireOwner() {
  const ownerEmail = process.env.DASHBOARD_OWNER_EMAIL?.toLowerCase();
  if (!ownerEmail) throw new Error("DASHBOARD_OWNER_EMAIL is not configured");

  const session = await getServerSession(authOptions);
  if (session?.user?.email?.toLowerCase() !== ownerEmail) throw new Error("Unauthorized");
  return session;
}

