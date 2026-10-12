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
      }),
      {
        title: "Python Engineer",
        company: "Acme",
        techStack: ["Python", "React"],
        status: "INTERVIEW",
      }
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
