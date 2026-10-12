import assert from "node:assert/strict";
import { test } from "node:test";
import { getJobPostingUrlUpdates } from "../src/lib/gmail/link-recovery.ts";
import type { JobEmail } from "../src/lib/gmail/parser.ts";

test("recovers posting links from associated processed emails even without a parseable job event", () => {
  const record = {
    id: "missing", origin: "GMAIL", title: "Software Engineer", jobPostingUrl: null,
    appliedAt: new Date("2026-10-01T00:00:00Z"),
    processedEmails: [{ messageId: "confirmation" }, { messageId: "update" }]
  };
  const email: JobEmail = {
    messageId: "confirmation", threadId: "t", from: "jobs@example.com",
    subject: "Application confirmation", text: "Your application is on file.",
    receivedAt: new Date("2026-10-01T00:00:00Z"),
    links: [
      { url: "https://url.jobstreet.com/tracked-posting", text: "Software EngineerAcmeApplied on 1 Oct" },
      { url: "https://url.jobstreet.com/recommendation", text: "Junior DeveloperOther Company" },
      { url: "https://url.jobstreet.com/applied", text: "applied jobs" }
    ]
  };
  assert.deepEqual(getJobPostingUrlUpdates([
    record,
    { ...record, id: "manual", origin: "MANUAL" },
    { ...record, id: "known", jobPostingUrl: "https://example.com/saved" },
    { ...record, id: "unlinked", processedEmails: [] },
    { ...record, id: "no-link", processedEmails: [{ messageId: "no-link" }] }
  ], [email, { ...email, messageId: "no-link", links: [] }]), [
    { id: "missing", jobPostingUrl: "https://url.jobstreet.com/tracked-posting" }
  ]);
});

test("uses the newest recoverable source email and skips ambiguous links", () => {
  const email: JobEmail = {
    messageId: "old", threadId: "t", from: "jobs@example.com", subject: "", text: "",
    receivedAt: new Date("2026-10-01T00:00:00Z"),
    links: [{ url: "https://example.com/old", text: "View job" }]
  };
  const record = {
    id: "missing", origin: "GMAIL", title: "Engineer", jobPostingUrl: null,
    processedEmails: [{ messageId: "old" }, { messageId: "new" }, { messageId: "ambiguous" }]
  };
  const newer = { ...email, messageId: "new", receivedAt: new Date("2026-10-02T00:00:00Z"), links: [{ url: "https://example.com/new", text: "View job" }] };
  const ambiguous = { ...newer, messageId: "ambiguous", receivedAt: new Date("2026-10-03T00:00:00Z"), links: [...email.links!, ...newer.links] };
  assert.deepEqual(getJobPostingUrlUpdates([record], [email, ambiguous, newer]), [
    { id: "missing", jobPostingUrl: "https://example.com/new" }
  ]);
  assert.deepEqual(getJobPostingUrlUpdates([{ ...record, processedEmails: [{ messageId: "ambiguous" }] }], [ambiguous]), []);
});
