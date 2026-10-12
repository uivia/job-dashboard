import assert from "node:assert/strict";
import { test } from "node:test";
import { extractAppliedAt, type JobEmail } from "../src/lib/gmail/parser.ts";

const email: JobEmail = {
  messageId: "rejection", threadId: "thread", from: "Jobstreet <noreply@e.jobstreet.com>",
  subject: "Application update for Backend Developer at Acme",
  text: "Your application is unlikely to progress further. Applied on 2\u200b9\u200b \u200bS\u200be\u200bp",
  receivedAt: new Date("2026-10-09T02:52:16Z")
};

test("recovers the explicit application date from a rejection, using the Manila calendar", () => {
  assert.equal(extractAppliedAt(email)?.toISOString(), "2026-09-28T16:00:00.000Z");
});

test("reads the spaced-out date used by JobStreet plain-text emails", () => {
  assert.equal(extractAppliedAt({ ...email, text: "Unlikely to progress further. Applied on 2 9 S e p" })?.toISOString(), "2026-09-28T16:00:00.000Z");
});

test("recognizes a confirmation that also mentions screening", () => {
  const confirmation = { ...email, text: "Thank you for applying for the Engineer role at Acme! Your application went through successfully, and our team is already reviewing your profile." };
  assert.deepEqual(extractAppliedAt(confirmation), email.receivedAt);
});

test("uses receipt emails even when their next steps mention screening or assessments", () => {
  for (const confirmation of [
    { subject: "Application Received: Python Developer @ Acme", text: "Thank you for applying. Our hiring team will begin the initial screening." },
    { subject: "Application received - Video Introduction", text: "We've received your application, and our team is now reviewing your profile." },
    { subject: "Thanks for applying to Acme!", text: "We're excited to see your application land in our inbox. If you're invited to interview, expect feedback within 48 hours." },
    { subject: "Hi John, thanks for completing your application!", text: "We've successfully received your initial information. While our team reviews your application, here are interview preparation tips." }
  ]) assert.deepEqual(extractAppliedAt({ ...email, ...confirmation }), email.receivedAt);
});

test("infers the previous year when a yearless application date crosses New Year", () => {
  assert.equal(extractAppliedAt({ ...email, text: "Applied on 29 Dec", receivedAt: new Date("2026-01-02T08:00:00Z") })?.toISOString(), "2025-12-28T16:00:00.000Z");
});

test("accepts an explicit year and rejects invalid or future application dates", () => {
  assert.equal(extractAppliedAt({ ...email, text: "Date Applied: September 29, 2026" })?.toISOString(), "2026-09-28T16:00:00.000Z");
  for (const text of ["Applied on 31 Sep 2026", "Applied on 29 Sep 2027", "Applied on 29 Feb 2025", "Interview on 29 Sep", "Your application is unlikely to progress further."]) {
    assert.equal(extractAppliedAt({ ...email, text }), null, text);
  }
});

test("uses the explicit date ahead of the confirmation timestamp", () => {
  assert.equal(extractAppliedAt({ ...email, text: "Thank you for applying. Applied on 29 Sep 2026" })?.toISOString(), "2026-09-28T16:00:00.000Z");
});
