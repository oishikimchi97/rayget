import { execa } from "execa";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli.js");
const run = process.env.RAYGET_E2E === "1" ? it : it.skip;

// Replace with a known-small public Raycast extension repo before running.
const SAMPLE_REPO = process.env.RAYGET_E2E_REPO ?? "raycast/extensions";

describe("integration (opt-in: RAYGET_E2E=1)", () => {
  run(
    "adds, lists, and removes a real extension",
    async () => {
      await execa("node", [cli, "add", SAMPLE_REPO, "--json"]);
      const { stdout } = await execa("node", [cli, "list", "--json"]);
      expect(stdout).toContain(SAMPLE_REPO.split("/").slice(0, 2).join("/"));
      await execa("node", [cli, "remove", SAMPLE_REPO, "--json"]);
    },
    300_000,
  );
});
