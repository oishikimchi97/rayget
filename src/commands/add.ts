import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  gitCheckout,
  gitClone,
  gitCurrentBranch,
  gitRevParse,
  locateExtensionRoot,
  npmInstall,
  readPackageJson,
} from "../cellar.js";
import { assertReadyToRegister } from "../env.js";
import { EXIT, RaygetError } from "../errors.js";
import { createLogger } from "../log.js";
import { type ExtensionEntry, readManifest, upsertEntry, writeManifest } from "../manifest.js";
import { type OutputOptions, info, printResult } from "../output.js";
import { cellarDirName, raygetPaths } from "../paths.js";
import { register } from "../registrar.js";
import { cloneUrl, parseSource, sourceId, webUrl } from "../url-parse.js";

export interface AddArgs {
  url: string;
  ref?: string;
  path?: string;
}

export async function cmdAdd(args: AddArgs, opts: OutputOptions): Promise<void> {
  const parsed = parseSource(args.url, { ref: args.ref, path: args.path });
  const id = sourceId(parsed);
  const paths = raygetPaths();
  const manifest = readManifest(paths.manifest);

  if (manifest.extensions[id]) {
    throw new RaygetError(
      EXIT.USAGE,
      `already installed: ${id} — use \`rayget upgrade ${id}\` to update it`,
    );
  }

  mkdirSync(paths.cellar, { recursive: true });
  const dirName = cellarDirName(parsed);
  const cloneDir = join(paths.cellar, dirName);

  info(`Cloning ${cloneUrl(parsed)} …`, opts);
  await gitClone(cloneUrl(parsed), cloneDir);
  if (parsed.ref) await gitCheckout(cloneDir, parsed.ref);

  const root = locateExtensionRoot(cloneDir, parsed.subdir);
  const pkg = readPackageJson(root);

  info("Installing dependencies …", opts);
  await npmInstall(root);

  await assertReadyToRegister();
  info("Registering with Raycast …", opts);
  const logger = createLogger(paths.log);
  await register({ cwd: root, log: logger.log });

  const ref = parsed.ref ?? (await gitCurrentBranch(cloneDir));
  const commit = await gitRevParse(cloneDir);
  const now = new Date().toISOString();
  const extensionRoot = relative(cloneDir, root) || ".";

  const entry: ExtensionEntry = {
    id,
    name: pkg.name ?? parsed.repo,
    title: pkg.title ?? pkg.name ?? parsed.repo,
    url: webUrl(parsed),
    ref,
    commit,
    path: `cellar/${dirName}`,
    extensionRoot,
    installedAt: now,
    updatedAt: now,
  };

  writeManifest(paths.manifest, upsertEntry(manifest, entry));

  printResult(
    entry,
    () => {
      info(`\nInstalled ${entry.title} (${id}) @ ${commit.slice(0, 7)}`, opts);
      info(`Source: ${entry.url}`, opts);
      info("Now searchable in Raycast.", opts);
    },
    opts,
  );
}
