import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseApplicationInput } from "../src/lib/validation.ts";

describe("parseApplicationInput", () => {
  test("trims fields and removes duplicate technology tags", () => {
    assert.deepEqual(
      parseApplicationInput({
        title: "  Python Engineer ",
        company: " Acme ",
        techStack: "Python, React, python",
        status: "INTERVIEW",
        jobPostingUrl: " https://example.com/jobs/python-engineer "
      }),
      {
        title: "Python Engineer",
        company: "Acme",
        techStack: ["Python", "React"],
        status: "INTERVIEW",
        jobPostingUrl: "https://example.com/jobs/python-engineer"
      }
    );
  });

  test("stores an empty job posting URL as null", () => {
    assert.equal(
      parseApplicationInput({
        title: "Engineer",
        company: "Acme",
        techStack: "",
        status: "APPLIED",
        jobPostingUrl: "  "
      }).jobPostingUrl,
      null
    );
  });

  test("rejects non-HTTP job posting URLs", () => {
    assert.throws(
      () => parseApplicationInput({
        title: "Engineer",
        company: "Acme",
        techStack: "",
        status: "APPLIED",
        jobPostingUrl: "javascript:alert(1)"
      }),
      /Job posting URL must use HTTP or HTTPS/
    );
  });

  test("rejects a missing title", () => {
    assert.throws(
      () => parseApplicationInput({ title: " ", company: "Acme", techStack: "", status: "APPLIED" }),
      /Job title is required/
    );
  });

  test("rejects an unknown status", () => {
    assert.throws(
      () => parseApplicationInput({ title: "Engineer", company: "Acme", techStack: "", status: "WAITING" }),
      /Invalid application status/
    );
  });
});
