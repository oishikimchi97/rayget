import { join } from "node:path";
import {
  gitFetch,
  gitRevParse,
  gitUpdateTo,
  locateExtensionRoot,
  npmInstall,
} from "../cellar.js";
import { assertReadyToRegister } from "../env.js";
import { EXIT, RaygetError } from "../errors.js";
import { createLogger } from "../log.js";
import { type ExtensionEntry, readManifest, upsertEntry, writeManifest } from "../manifest.js";
import { type OutputOptions, info, printResult } from "../output.js";
import { raygetPaths } from "../paths.js";
import { register } from "../registrar.js";

export interface UpgradeArgs {
  id?: string;
  all: boolean;
}

interface UpgradeResult {
  id: string;
  from: string;
  to: string;
  changed: boolean;
}

async function upgradeOne(
  entry: ExtensionEntry,
  rootDir: string,
  logFile: string,
  opts: OutputOptions,
): Promise<UpgradeResult> {
  const cloneDir = join(rootDir, entry.path);
  info(`Fetching ${entry.id} …`, opts);
  await gitFetch(cloneDir);
  await gitUpdateTo(cloneDir, entry.ref);

  const newCommit = await gitRevParse(cloneDir);
  if (newCommit === entry.commit) {
    info(`${entry.id} already up-to-date (${newCommit.slice(0, 7)})`, opts);
    return { id: entry.id, from: entry.commit, to: newCommit, changed: false };
  }

  const root = locateExtensionRoot(
    cloneDir,
    entry.extensionRoot === "." ? undefined : entry.extensionRoot,
  );
  info("Installing dependencies …", opts);
  await npmInstall(root);

  await assertReadyToRegister();
  info("Re-registering with Raycast …", opts);
  await register({ cwd: root, log: createLogger(logFile).log });

  return { id: entry.id, from: entry.commit, to: newCommit, changed: true };
}

export async function cmdUpgrade(args: UpgradeArgs, opts: OutputOptions): Promise<void> {
  const paths = raygetPaths();
  let manifest = readManifest(paths.manifest);

  let targets: ExtensionEntry[];
  if (args.all) {
    targets = Object.values(manifest.extensions);
  } else if (args.id) {
    const entry = manifest.extensions[args.id];
    if (!entry) throw new RaygetError(EXIT.USAGE, `not installed: ${args.id}`);
    targets = [entry];
  } else {
    throw new RaygetError(EXIT.USAGE, "upgrade requires an <id> or --all");
  }

  const results: UpgradeResult[] = [];
  for (const entry of targets) {
    const result = await upgradeOne(entry, paths.root, paths.log, opts);
    results.push(result);
    if (result.changed) {
      manifest = upsertEntry(manifest, {
        ...entry,
        commit: result.to,
        updatedAt: new Date().toISOString(),
      });
      writeManifest(paths.manifest, manifest);
    }
  }

  printResult(
    { upgraded: results },
    () => {
      const changed = results.filter((r) => r.changed);
      info(
        changed.length === 0
          ? "Everything already up-to-date."
          : `Upgraded ${changed.length} extension(s).`,
        opts,
      );
    },
    opts,
  );
}
