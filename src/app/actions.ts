"use server";

import { revalidatePath } from "next/cache";
import { applicationUpdateData } from "@/lib/application-update";
import { db } from "@/lib/db";
import { GmailAuthorizationError, GmailPermissionError } from "@/lib/gmail/client";
import { syncJobEmails, type SyncResult } from "@/lib/gmail/sync";
import { requireOwner } from "@/lib/owner";
import { parseApplicationInput } from "@/lib/validation";

type RawInput = { title: string; company: string; techStack: string; status: string; jobPostingUrl: string };

export async function syncGmail(): Promise<SyncResult> {
  const session = await requireOwner();
  if (!session.accessToken || session.error) {
    return {
      added: 0,
      updated: 0,
      ignored: 0,
      failed: 0,
      requiresReconnect: true,
      remaining: 0,
      errorMessage: session.error
        ? "Google rejected the saved authorization. Sign out and reconnect your Google account."
        : "Google did not provide an access token for Gmail. Sign out and reconnect your Google account."
    };
  }
  try {
    const result = await syncJobEmails(session.accessToken);
    revalidatePath("/");
    return result;
  } catch (error) {
    if (error instanceof GmailAuthorizationError) {
      return { added: 0, updated: 0, ignored: 0, failed: 0, requiresReconnect: true, remaining: 0 };
    }
    if (error instanceof GmailPermissionError) {
      return {
        added: 0,
        updated: 0,
        ignored: 0,
        failed: 0,
        requiresReconnect: false,
        remaining: 0,
        errorMessage: error.message
      };
    }
    throw error;
  }
}

export async function createApplication(input: RawInput): Promise<void> {
  await requireOwner();
  const parsed = parseApplicationInput(input);
  await db.jobApplication.create({
    data: { ...parsed, origin: "MANUAL", appliedAt: new Date(), statusUpdatedAt: new Date() }
  });
  revalidatePath("/");
}

export async function updateApplication(id: string, input: RawInput): Promise<void> {
  await requireOwner();
  if (!id) throw new Error("Application ID is required");
  const parsed = parseApplicationInput(input);
  const existing = await db.jobApplication.findUniqueOrThrow({ where: { id }, select: { status: true } });
  await db.jobApplication.update({
    where: { id },
    data: applicationUpdateData(existing.status, parsed)
  });
  revalidatePath("/");
}

export async function deleteApplication(id: string): Promise<void> {
  await requireOwner();
  if (!id) throw new Error("Application ID is required");
  await db.jobApplication.delete({ where: { id } });
  revalidatePath("/");
}
