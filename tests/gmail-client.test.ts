import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decodeGmailMessage, getGmailMessages, gmailSearchQuery, listGmailMessageIds } from "../src/lib/gmail/client.ts";

const encode = (value: string) => Buffer.from(value).toString("base64url");

describe("Gmail client helpers", () => {
  test("builds the fixed ninety-day job email query", () => {
    assert.equal(
      gmailSearchQuery,
      'newer_than:90d -in:spam -in:trash {subject:(application) subject:(interview) subject:(assessment) subject:(offer) subject:(candidate) subject:(next steps) subject:(hiring process)}'
    );
  });

  test("decodes headers and nested text parts", () => {
    const email = decodeGmailMessage({
      id: "m1",
      threadId: "t1",
      internalDate: "1791163354000",
      snippet: "fallback",
      payload: {
        headers: [
          { name: "From", value: "Recruiter <jobs@example.com>" },
          { name: "Subject", value: "Interview for Software Engineer at Acme" }
        ],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [{ mimeType: "text/plain", body: { data: encode("Your interview is confirmed.") } }]
          }
        ]
      }
    });

    assert.deepEqual(email, {
      messageId: "m1",
      threadId: "t1",
      receivedAt: new Date(1791163354000),
      from: "Recruiter <jobs@example.com>",
      subject: "Interview for Software Engineer at Acme",
      text: "Your interview is confirmed.",
      links: []
    });
  });

  test("converts HTML-only messages to readable text", () => {
    const email = decodeGmailMessage({
      id: "m2",
      threadId: "t2",
      internalDate: "1791163354000",
      snippet: "",
      payload: {
        headers: [],
        mimeType: "text/html",
        body: { data: encode('<p>Application&nbsp;<strong>received</strong></p><a href="https://example.com/jobs/123?from=email&amp;source=confirmation">View job</a>') }
      }
    });

    assert.equal(email.text, "Application received View job");
    assert.deepEqual(email.links, [{
      url: "https://example.com/jobs/123?from=email&source=confirmation",
      text: "View job"
    }]);
  });

  test("collects HTTP links from plain-text messages", () => {
    const email = decodeGmailMessage({
      id: "m-plain-link",
      internalDate: "1791163354000",
      payload: {
        headers: [],
        mimeType: "text/plain",
        body: { data: encode("View the role at https://www.linkedin.com/jobs/view/12345.") }
      }
    });

    assert.deepEqual(email.links, [{
      url: "https://www.linkedin.com/jobs/view/12345",
      text: "View the role at"
    }]);
  });

  test("preserves the same-line label for a plain-text URL", () => {
    const email = decodeGmailMessage({
      id: "m-labelled-plain-link",
      internalDate: "1791163354000",
      payload: {
        headers: [],
        mimeType: "text/plain",
        body: { data: encode("View job posting: https://careers.acme.example/jobs/123") }
      }
    });

    assert.deepEqual(email.links, [{
      url: "https://careers.acme.example/jobs/123",
      text: "View job posting:"
    }]);
  });

  test("paginates through more than one thousand matching messages", async () => {
    let page = 0;
    const ids = await listGmailMessageIds("token", async () => {
      const count = page === 10 ? 1 : 100;
      const messages = Array.from({ length: count }, (_, index) => ({ id: `message-${page * 100 + index}` }));
      const nextPageToken = page < 10 ? `page-${page + 1}` : undefined;
      page++;
      return new Response(JSON.stringify({ messages, nextPageToken }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    assert.equal(ids.length, 1001);
    assert.equal(ids.at(-1), "message-1000");
  });

  test("rejects missing or invalid timestamps instead of using the sync time", () => {
    for (const internalDate of [undefined, "", " ", "invalid", "Infinity", "9999999999999999999"]) {
      assert.throws(() => decodeGmailMessage({ id: "bad-timestamp", internalDate }), /valid timestamp/i);
    }
  });

  test("keeps valid emails in a batch when another email has an invalid timestamp", async () => {
    const result = await getGmailMessages("token", ["valid", "invalid"], async (input) => {
      const id = String(input).includes("/valid?") ? "valid" : "invalid";
      return new Response(JSON.stringify({
        id,
        internalDate: id === "valid" ? "1791163354000" : "invalid"
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    assert.deepEqual(result.emails.map(({ messageId }) => messageId), ["valid"]);
    assert.equal(result.failed, 1);
  });
});
