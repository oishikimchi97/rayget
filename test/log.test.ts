import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/log.js";

describe("createLogger", () => {
  it("appends lines and tails the last N", () => {
    const file = join(mkdtempSync(join(tmpdir(), "rayget-log-")), "rayget.log");
    const logger = createLogger(file);
    for (let i = 1; i <= 5; i++) logger.log(`line ${i}`);
    expect(readFileSync(file, "utf8")).toContain("line 5");
    expect(logger.tail(2).trim().split("\n")).toEqual(["line 4", "line 5"]);
  });
});
