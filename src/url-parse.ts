import { EXIT, RaygetError } from "./errors.js";

export interface ParsedSource {
  host: string;
  owner: string;
  repo: string;
  ref?: string;
  subdir?: string;
}

export interface SourceOverrides {
  ref?: string;
  path?: string;
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;

function cleanRepo(repo: string): string {
  return repo.replace(/\.git$/, "");
}

export function parseSource(input: string, overrides: SourceOverrides = {}): ParsedSource {
  const trimmed = input.trim().replace(/\/+$/, "");
  let host = "github.com";
  let rest = trimmed;

  const urlMatch = trimmed.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (urlMatch) {
    host = urlMatch[1]!;
    rest = urlMatch[2]!;
  }

  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new RaygetError(EXIT.USAGE, `cannot parse source: ${input}`);
  }

  const owner = parts[0]!;
  const repo = cleanRepo(parts[1]!);
  let ref: string | undefined;
  let subdir: string | undefined;

  if (parts[2] === "tree" && parts.length >= 4) {
    ref = parts[3];
    const sub = parts.slice(4).join("/");
    subdir = sub.length > 0 ? sub : undefined;
  } else if (parts.length > 2) {
    throw new RaygetError(EXIT.USAGE, `cannot parse source: ${input}`);
  }

  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) {
    throw new RaygetError(EXIT.USAGE, `cannot parse source: ${input}`);
  }

  if (overrides.ref) ref = overrides.ref;
  if (overrides.path) subdir = overrides.path.replace(/^\/+|\/+$/g, "");

  return { host, owner, repo, ref, subdir };
}

export function sourceId(p: ParsedSource): string {
  return p.subdir ? `${p.owner}/${p.repo}/${p.subdir}` : `${p.owner}/${p.repo}`;
}

export function cloneUrl(p: ParsedSource): string {
  return `https://${p.host}/${p.owner}/${p.repo}.git`;
}

export function webUrl(p: ParsedSource): string {
  return `https://${p.host}/${p.owner}/${p.repo}`;
}
