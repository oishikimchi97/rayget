#!/usr/bin/env node
import { parseArgs } from "node:util";
import { cmdAdd } from "./commands/add.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdList } from "./commands/list.js";
import { cmdRemove } from "./commands/remove.js";
import { cmdUpgrade } from "./commands/upgrade.js";
import { EXIT, RaygetError } from "./errors.js";
import { type OutputOptions, printError } from "./output.js";

const VERSION = "0.1.0";

const HELP = `rayget — install & manage unpublished Raycast extensions from GitHub

Usage:
  rayget add <github-url> [--ref <branch|tag|sha>] [--path <subdir>]
  rayget list [--offline]
  rayget upgrade [<id> | --all]
  rayget remove <id>
  rayget doctor
  rayget --help | --version

Global flags:
  --json     machine-readable output (auto when stdout is not a TTY)
`;

function resolveJson(flag: boolean | undefined): boolean {
  return flag ?? !process.stdout.isTTY;
}

async function run(): Promise<number> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: "boolean" },
      version: { type: "boolean" },
      json: { type: "boolean" },
      offline: { type: "boolean" },
      all: { type: "boolean" },
      ref: { type: "string" },
      path: { type: "string" },
    },
  });

  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return EXIT.OK;
  }

  const command = positionals[0];
  if (!command || values.help) {
    process.stdout.write(HELP);
    return command ? EXIT.OK : values.help ? EXIT.OK : EXIT.USAGE;
  }

  const opts: OutputOptions = { json: resolveJson(values.json as boolean | undefined) };

  switch (command) {
    case "add": {
      const url = positionals[1];
      if (!url) throw new RaygetError(EXIT.USAGE, "add requires a <github-url>");
      await cmdAdd(
        { url, ref: values.ref as string | undefined, path: values.path as string | undefined },
        opts,
      );
      return EXIT.OK;
    }
    case "list":
      await cmdList({ offline: Boolean(values.offline) }, opts);
      return EXIT.OK;
    case "upgrade":
      await cmdUpgrade({ id: positionals[1], all: Boolean(values.all) }, opts);
      return EXIT.OK;
    case "remove": {
      const id = positionals[1];
      if (!id) throw new RaygetError(EXIT.USAGE, "remove requires an <id>");
      await cmdRemove({ id }, opts);
      return EXIT.OK;
    }
    case "doctor":
      return cmdDoctor(opts);
    default:
      throw new RaygetError(EXIT.USAGE, `unknown command: ${command}`);
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const json = process.argv.includes("--json") || !process.stdout.isTTY;
    printError(err, { json });
    process.exit(err instanceof RaygetError ? err.code : EXIT.GENERIC);
  });
