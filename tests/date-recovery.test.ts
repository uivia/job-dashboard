import assert from "node:assert/strict";
import { test } from "node:test";
import { getAppliedDateUpdates } from "../src/lib/gmail/date-recovery.ts";
import type { JobEmail } from "../src/lib/gmail/parser.ts";

test("recovers missing dates from linked processed emails without guessing or replacing known dates", () => {
  const record = { id: "missing", origin: "GMAIL", appliedAt: null, processedEmails: [{ messageId: "rejection" }, { messageId: "confirmation" }] };
  const email: JobEmail = {
    messageId: "rejection", threadId: "t", from: "jobs@example.com",
    subject: "Application update for Engineer at Acme", text: "Unlikely to progress further. Applied on 29 Sep",
    receivedAt: new Date("2026-10-09T02:52:16Z")
  };
  const updates = getAppliedDateUpdates([
    record,
    { ...record, id: "manual", origin: "MANUAL" },
    { ...record, id: "known", appliedAt: new Date("2026-09-30T08:00:00Z") },
    { ...record, id: "unknown", processedEmails: [{ messageId: "interview" }] },
    { ...record, id: "unlinked", processedEmails: [] }
  ], [
    email,
    { ...email, messageId: "confirmation", text: "Thank you for applying.", receivedAt: new Date("2026-09-29T08:00:00Z") },
    { ...email, messageId: "interview", subject: "Interview for Engineer at Acme", text: "Your interview is confirmed." }
  ]);
  assert.deepEqual(updates, [{ id: "missing", appliedAt: new Date("2026-09-28T16:00:00Z") }]);
});
