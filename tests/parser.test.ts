import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseJobEmail } from "../src/lib/gmail/parser.ts";

describe("parseJobEmail", () => {
  test("extracts a JobStreet application confirmation", () => {
    const event = parseJobEmail({
      messageId: "m1",
      threadId: "t1",
      from: "Jobstreet Applications <noreply@e.jobstreet.com>",
      subject: "Your application was successfully submitted",
      text: "Your application for Full Stack Developer was successfully submitted to VST ECS Phils Inc.",
      receivedAt: new Date("2026-10-05T01:22:27Z")
    });

    assert.deepEqual(event, {
      messageId: "m1",
      threadId: "t1",
      receivedAt: new Date("2026-10-05T01:22:27Z"),
      appliedAt: new Date("2026-10-05T01:22:27Z"),
      title: "Full Stack Developer",
      company: "VST ECS Phils Inc",
      techStack: [],
      status: "APPLIED",
      jobPostingUrl: null
    });
  });

  test("extracts explicit technology names without guessing", () => {
    const event = parseJobEmail({
      messageId: "m2",
      threadId: "t2",
      from: "Indeed Apply <indeedapply@indeed.com>",
      subject: "Indeed Application: Python & React.js Engineer | Hybrid",
      text: "Application received for Python & React.js Engineer at Acme Labs.",
      receivedAt: new Date("2026-10-05T01:18:11Z")
    });

    assert.deepEqual(event?.techStack, ["Python", "React"]);
  });

  test("removes punctuation from company names", () => {
    const event = parseJobEmail({
      messageId: "m-company-punctuation",
      threadId: "t-company-punctuation",
      from: "Recruiting <jobs@acme.example>",
      subject: "Your application for Engineer at Acme, Inc.",
      text: "We received your application.",
      receivedAt: new Date("2026-10-05T01:18:11Z")
    });

    assert.equal(event?.company, "Acme Inc");
  });

  test("extracts a uniquely labelled job posting link", () => {
    const event = parseJobEmail({
      messageId: "m-labelled-link",
      threadId: "t-labelled-link",
      from: "Recruiting <jobs@acme.example>",
      subject: "Your application for Engineer at Acme",
      text: "We received your application.",
      links: [
        { url: "https://acme.example/privacy", text: "Privacy" },
        { url: "https://acme.example/jobs/engineer", text: "View job posting" }
      ],
      receivedAt: new Date("2026-10-05T01:18:11Z")
    });

    assert.equal(event?.jobPostingUrl, "https://acme.example/jobs/engineer");
  });

  test("extracts a recognized job-detail URL without descriptive link text", () => {
    const event = parseJobEmail({
      messageId: "m-known-link",
      threadId: "t-known-link",
      from: "LinkedIn <jobs-noreply@linkedin.com>",
      subject: "Your application for Engineer at Acme",
      text: "We received your application.",
      links: [{
        url: "https://www.linkedin.com/jobs/view/12345",
        text: "https://www.linkedin.com/jobs/view/12345"
      }],
      receivedAt: new Date("2026-10-05T01:18:11Z")
    });

    assert.equal(event?.jobPostingUrl, "https://www.linkedin.com/jobs/view/12345");
  });

  test("accepts supported job-provider detail URLs", async (context) => {
    const urls = [
      "https://ph.indeed.com/viewjob?jk=abc123",
      "https://ph.jobstreet.com/job/12345",
      "https://www.seek.com.au/job/12345",
      "https://jobs.lever.co/acme/abc123",
      "https://boards.greenhouse.io/acme/jobs/12345",
      "https://acme.wd5.myworkdayjobs.com/en-US/jobs/job/Manila/Engineer_R123"
    ];

    for (const url of urls) {
      await context.test(url, () => {
        const event = parseJobEmail({
          messageId: url,
          threadId: null,
          from: "Recruiting <jobs@example.com>",
          subject: "Your application for Engineer at Acme",
          text: "We received your application.",
          links: [{ url, text: url }],
          receivedAt: new Date("2026-10-05T01:18:11Z")
        });

        assert.equal(event?.jobPostingUrl, url);
      });
    }
  });

  test("rejects lookalike provider domains and incomplete detail routes", () => {
    const urls = [
      "https://evilindeed.com/viewjob?jk=abc123",
      "https://eviljobstreet.com/job/12345",
      "https://evilseek.com/job/12345",
      "https://notmyworkdayjobs.com/job/Engineer_R123",
      "https://www.linkedin.com/jobs/view/",
      "https://boards.greenhouse.io/acme/jobs/"
    ];

    for (const url of urls) {
      const event = parseJobEmail({
        messageId: url,
        threadId: null,
        from: "Recruiting <jobs@example.com>",
        subject: "Your application for Engineer at Acme",
        text: "We received your application.",
        links: [{ url, text: url }],
        receivedAt: new Date("2026-10-05T01:18:11Z")
      });

      assert.equal(event?.jobPostingUrl, null, url);
    }
  });

  test("leaves the posting URL blank when equally strong candidates are ambiguous", () => {
    const event = parseJobEmail({
      messageId: "m-ambiguous-links",
      threadId: "t-ambiguous-links",
      from: "Recruiting <jobs@acme.example>",
      subject: "Your application for Engineer at Acme",
      text: "We received your application.",
      links: [
        { url: "https://acme.example/jobs/engineer", text: "View job" },
        { url: "https://acme.example/jobs/engineer-2", text: "Job details" }
      ],
      receivedAt: new Date("2026-10-05T01:18:11Z")
    });

    assert.equal(event?.jobPostingUrl, null);
  });

  test("does not treat ordinary next-step prose as Next.js", () => {
    const event = parseJobEmail({
      messageId: "m-next",
      threadId: "t-next",
      from: "Recruiting <jobs@acme.example>",
      subject: "Your application for Software Engineer at Acme",
      text: "We received your application. Here is what happens next.",
      receivedAt: new Date("2026-10-05T01:18:11Z")
    });

    assert.deepEqual(event?.techStack, []);
  });

  test("recognizes a rejection update", () => {
    const event = parseJobEmail({
      messageId: "m3",
      threadId: "t3",
      from: "Jobstreet Applications <noreply@e.jobstreet.com>",
      subject: "Application update for Software Engineer at Asticom Technology Inc",
      text: "It appears your application is unlikely to progress further.",
      receivedAt: new Date("2026-09-13T04:47:50Z")
    });

    assert.equal(event?.status, "REJECTED");
    assert.equal(event?.title, "Software Engineer");
    assert.equal(event?.company, "Asticom Technology Inc");
  });

  test("extracts a recruiter interview with slash-separated company", () => {
    const event = parseJobEmail({
      messageId: "m-interview",
      threadId: "t-interview",
      from: "Recruiter <jobs@acme.example>",
      subject: "Python Engineer Technical Interview: John / White Cloak",
      text: "We are pleased to confirm your interview.",
      receivedAt: new Date("2026-09-24T08:14:43Z")
    });

    assert.equal(event?.status, "INTERVIEW");
    assert.equal(event?.title, "Python Engineer");
    assert.equal(event?.company, "White Cloak");
  });

  test("extracts an offer subject with title and company", () => {
    const event = parseJobEmail({
      messageId: "m-offer",
      threadId: "t-offer",
      from: "People Team <people@acme.example>",
      subject: "Job Offer: Software Engineer | Acme Labs",
      text: "We are pleased to offer you this position.",
      receivedAt: new Date("2026-09-28T08:14:43Z")
    });

    assert.equal(event?.status, "OFFER");
    assert.equal(event?.title, "Software Engineer");
    assert.equal(event?.company, "Acme Labs");
  });

  test("does not treat a canceled interview as a rejection", () => {
    const event = parseJobEmail({
      messageId: "m4",
      threadId: "t4",
      from: "Recruiter <recruiter@example.com>",
      subject: "Canceled: Technical Interview for Python Developer",
      text: "This event has been canceled and removed from your calendar.",
      receivedAt: new Date("2026-09-23T00:13:38Z")
    });

    assert.equal(event, null);
  });

  test("ignores unrelated email", () => {
    const event = parseJobEmail({
      messageId: "m5",
      threadId: "t5",
      from: "GitHub <noreply@github.com>",
      subject: "A GitHub OAuth application was added",
      text: "Visit your account settings.",
      receivedAt: new Date("2026-10-04T09:08:44Z")
    });

    assert.equal(event, null);
  });
});
