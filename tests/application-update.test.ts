import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationUpdateData } from "../src/lib/application-update.ts";

const input = { title: "Engineer", company: "Acme", techStack: ["Python"], status: "INTERVIEW" as const };
const now = new Date("2026-10-05T10:00:00Z");

test("field-only edits preserve the status evidence timestamp", () => {
  assert.deepEqual(applicationUpdateData("INTERVIEW", input, now), input);
});

test("status changes advance the status evidence timestamp", () => {
  assert.deepEqual(applicationUpdateData("APPLIED", input, now), { ...input, statusUpdatedAt: now });
});
