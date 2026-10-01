import { describe, expect, it } from "vitest";
import { linesIn } from "@/components/analyst/cite";

describe("analyst citations", () => {
  it("reads the lines a passage refers to", () => {
    expect(linesIn("Line 4 up ₹850 (6.07%).")).toEqual([4]);
    expect(linesIn("Lines 1, 3 and 5 rest on prior pricing")).toEqual([1, 3, 5]);
    expect(linesIn("B at ₹2,130", "10")).toEqual([10]);
    expect(linesIn("₹1.31 crore total")).toEqual([]);
  });
});
