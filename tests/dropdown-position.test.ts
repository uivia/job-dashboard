import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getDropdownPosition } from "../src/lib/dropdown-position.ts";
import { getNextTabStop } from "../src/lib/dropdown-focus.ts";

describe("getDropdownPosition", () => {
  test("places a menu below its trigger when there is room", () => {
    assert.deepEqual(getDropdownPosition(
      { left: 120, top: 80, bottom: 120, width: 140 },
      160,
      800,
      600
    ), { left: 120, top: 128, width: 140, maxHeight: 160, placement: "bottom" });
  });

  test("flips a tall menu above the trigger when there is more room", () => {
    assert.deepEqual(getDropdownPosition(
      { left: 120, top: 500, bottom: 540, width: 140 },
      360,
      800,
      600
    ), { left: 120, top: 132, width: 140, maxHeight: 360, placement: "top" });
  });

  test("limits the menu to the available space on a short viewport", () => {
    assert.deepEqual(getDropdownPosition(
      { left: 120, top: 120, bottom: 160, width: 140 },
      200,
      320,
      240
    ), { left: 120, top: 8, width: 140, maxHeight: 104, placement: "top" });
  });

  test("clamps menu width and position to narrow viewport edges", () => {
    assert.deepEqual(getDropdownPosition(
      { left: 300, top: 20, bottom: 60, width: 40 },
      160,
      320,
      240
    ), { left: 272, top: 68, width: 40, maxHeight: 160, placement: "bottom" });
  });
});

describe("getNextTabStop", () => {
  test("skips untabbable popup options when moving through page controls", () => {
    const before = { tabIndex: 0 };
    const trigger = { tabIndex: 0 };
    const option = { tabIndex: -1 };
    const after = { tabIndex: 0 };
    const elements = [before, trigger, option, after];

    assert.equal(getNextTabStop(elements, trigger), after);
    assert.equal(getNextTabStop(elements, trigger, true), before);
  });
});
