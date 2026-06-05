import { homedir } from "node:os";
import { join } from "node:path";
import type { ParsedSource } from "./url-parse.js";

export interface Paths {
  root: string;
  cellar: string;
  manifest: string;
  log: string;
}

export function raygetPaths(home: string = homedir()): Paths {
  const root = join(home, ".rayget");
  return {
    root,
    cellar: join(root, "cellar"),
    manifest: join(root, "manifest.json"),
    log: join(root, "rayget.log"),
  };
}

export function cellarDirName(p: ParsedSource): string {
  const base = `${p.owner}__${p.repo}`;
  if (!p.subdir) return base;
  return `${base}__${p.subdir.replace(/\//g, "_")}`;
}
