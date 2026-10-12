"use server";

import { revalidatePath } from "next/cache";
import { applicationUpdateData } from "@/lib/application-update";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { parseApplicationInput } from "@/lib/validation";

type RawInput = { title: string; company: string; techStack: string; status: string };

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
