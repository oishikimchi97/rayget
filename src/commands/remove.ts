import { rmSync } from "node:fs";
import { join } from "node:path";
import { EXIT, RaygetError } from "../errors.js";
import { readManifest, removeEntry, writeManifest } from "../manifest.js";
import { type OutputOptions, info, printResult } from "../output.js";
import { raygetPaths } from "../paths.js";

export interface RemoveArgs {
  id: string;
}

export async function cmdRemove(args: RemoveArgs, opts: OutputOptions): Promise<void> {
  const paths = raygetPaths();
  const manifest = readManifest(paths.manifest);
  const entry = manifest.extensions[args.id];

  if (!entry) {
    throw new RaygetError(EXIT.USAGE, `not installed: ${args.id} (see \`rayget list\`)`);
  }

  rmSync(join(paths.root, entry.path), { recursive: true, force: true });
  writeManifest(paths.manifest, removeEntry(manifest, args.id));

  printResult(
    { removed: args.id, title: entry.title, guiStepRequired: true },
    () => {
      info(`Removed ${entry.title} (${args.id}) from rayget.`, opts);
      info("", opts);
      info("Raycast keeps a registration for local extensions. To fully remove it:", opts);
      info(`  Raycast → Settings → Extensions → ${entry.title} → Remove`, opts);
    },
    opts,
  );
}
