import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const MANIFEST_VERSION = 1;

export interface ExtensionEntry {
  id: string;
  name: string;
  title: string;
  url: string;
  ref: string;
  commit: string;
  path: string;
  extensionRoot: string;
  installedAt: string;
  updatedAt: string;
}

export interface Manifest {
  version: number;
  extensions: Record<string, ExtensionEntry>;
}

export function emptyManifest(): Manifest {
  return { version: MANIFEST_VERSION, extensions: {} };
}

export function readManifest(file: string): Manifest {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return emptyManifest();
  }
  const parsed = JSON.parse(raw) as Partial<Manifest>;
  return {
    version: MANIFEST_VERSION,
    extensions: parsed.extensions ?? {},
  };
}

export function writeManifest(file: string, manifest: Manifest): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function upsertEntry(manifest: Manifest, entry: ExtensionEntry): Manifest {
  return {
    ...manifest,
    extensions: { ...manifest.extensions, [entry.id]: entry },
  };
}

export function removeEntry(manifest: Manifest, id: string): Manifest {
  const next = { ...manifest.extensions };
  delete next[id];
  return { ...manifest, extensions: next };
}
