import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ExtensionEntry,
  emptyManifest,
  readManifest,
  removeEntry,
  upsertEntry,
  writeManifest,
} from "../src/manifest.js";

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "rayget-"));
  return join(dir, "manifest.json");
}

const sample: ExtensionEntry = {
  id: "owner/repo",
  name: "wandb",
  title: "Weights & Biases",
  url: "https://github.com/owner/repo",
  ref: "master",
  commit: "e27838d",
  path: "cellar/owner__repo",
  extensionRoot: ".",
  installedAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

describe("manifest", () => {
  it("returns an empty manifest when the file is missing", () => {
    const m = readManifest(tmpFile());
    expect(m).toEqual(emptyManifest());
    expect(m.version).toBe(1);
  });

  it("round-trips through write and read", () => {
    const file = tmpFile();
    writeManifest(file, upsertEntry(emptyManifest(), sample));
    const m = readManifest(file);
    expect(m.extensions["owner/repo"]).toEqual(sample);
  });

  it("upsert replaces an existing entry by id", () => {
    let m = upsertEntry(emptyManifest(), sample);
    m = upsertEntry(m, { ...sample, commit: "abc1234" });
    expect(Object.keys(m.extensions)).toHaveLength(1);
    expect(m.extensions["owner/repo"]!.commit).toBe("abc1234");
  });

  it("removeEntry drops an entry", () => {
    const m = removeEntry(upsertEntry(emptyManifest(), sample), "owner/repo");
    expect(m.extensions).toEqual({});
  });

  it("migrates an unversioned legacy file to version 1", () => {
    const file = tmpFile();
    writeFileSync(file, JSON.stringify({ extensions: {} }));
    expect(readManifest(file).version).toBe(1);
  });

  it("writes pretty JSON ending in a newline", () => {
    const file = tmpFile();
    writeManifest(file, emptyManifest());
    const raw = readFileSync(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("\n  ");
  });
});
