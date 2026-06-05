import { join } from "node:path";
import { gitRemoteCommit } from "../cellar.js";
import { type ExtensionEntry, readManifest } from "../manifest.js";
import { type OutputOptions, printTable } from "../output.js";
import { raygetPaths } from "../paths.js";

export interface ListArgs {
  offline: boolean;
}

async function updateStatus(
  entry: ExtensionEntry,
  rootDir: string,
  offline: boolean,
): Promise<string> {
  if (offline) return "?";
  try {
    const remote = await gitRemoteCommit(join(rootDir, entry.path), entry.ref);
    if (!remote) return "?";
    return remote.startsWith(entry.commit) || entry.commit.startsWith(remote)
      ? "up-to-date"
      : "update available";
  } catch {
    return "?";
  }
}

export async function cmdList(args: ListArgs, opts: OutputOptions): Promise<void> {
  const paths = raygetPaths();
  const manifest = readManifest(paths.manifest);
  const entries = Object.values(manifest.extensions);

  const rows = await Promise.all(
    entries.map(async (e) => ({
      id: e.id,
      title: e.title,
      ref: e.ref,
      commit: e.commit.slice(0, 7),
      installed: e.installedAt.slice(0, 10),
      update: await updateStatus(e, paths.root, args.offline),
    })),
  );

  printTable(rows, opts);
}
