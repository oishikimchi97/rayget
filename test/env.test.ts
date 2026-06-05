import { describe, expect, it } from "vitest";
import { type Runner, runDoctor, summarize } from "../src/env.js";

const allGood: Runner = {
  async which(bin) {
    return `/usr/bin/${bin}`;
  },
  async version() {
    return "v24.2.0";
  },
  async raycastRunning() {
    return true;
  },
  raycastInstalled() {
    return true;
  },
  writable() {
    return true;
  },
};

describe("runDoctor", () => {
  it("reports all checks ok in a healthy environment", async () => {
    const results = await runDoctor(allGood);
    const names = results.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(["node", "npm", "git", "raycast", "~/.rayget"]),
    );
    expect(results.filter((r) => r.name !== "ray login").every((r) => r.ok)).toBe(true);
  });

  it("flags a missing binary with an actionable fix", async () => {
    const noNode: Runner = {
      ...allGood,
      async which(bin) {
        if (bin === "node") return null;
        return `/usr/bin/${bin}`;
      },
    };
    const results = await runDoctor(noNode);
    const node = results.find((r) => r.name === "node")!;
    expect(node.ok).toBe(false);
    expect(node.fix).toMatch(/install node/i);
  });

  it("flags Raycast not running", async () => {
    const notRunning: Runner = {
      ...allGood,
      async raycastRunning() {
        return false;
      },
    };
    const raycast = (await runDoctor(notRunning)).find((r) => r.name === "raycast")!;
    expect(raycast.ok).toBe(false);
  });

  it("summarize is true only when every non-informational check passes", async () => {
    expect(summarize(await runDoctor(allGood))).toBe(true);
    const noGit: Runner = {
      ...allGood,
      async which(bin) {
        if (bin === "git") return null;
        return `/usr/bin/${bin}`;
      },
    };
    expect(summarize(await runDoctor(noGit))).toBe(false);
  });
});
