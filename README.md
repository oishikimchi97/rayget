# rayget

A Homebrew-style CLI to install and manage **unpublished Raycast extensions
from a GitHub URL** — `rayget add <url>`, `upgrade`, `list`, `remove`.

> See [the design spec](docs/specs/2026-06-05-rayget-design.md).

Unlike the Raycast Store, this manages *local/development* extensions: it clones
the repo, builds it, and registers it with Raycast via the `ray` CLI. Extensions
installed this way are never auto-updated by the Store — `rayget` updates them on
demand.

## Why

Lots of useful Raycast extensions never get published to the Store. Today using
them means cloning, `npm install`, and `npm run dev` by hand — with no inventory
and no easy way to update. `rayget` makes that a one-liner and keeps a registry.

## Requirements

- macOS with the Raycast app (running, logged in)
- Node.js + npm
- git

## Install

```bash
npm i -g rayget   # or: npx rayget <command>
```

## Usage

```bash
rayget add https://github.com/owner/repo          # install from a repo URL
rayget add owner/repo --ref v1.2.0                # pin a tag/branch/sha
rayget add owner/repo --path packages/ext         # monorepo subdir
rayget list [--offline]                           # show installed + update status
rayget upgrade <id> | --all                       # update to latest of the recorded ref
rayget remove <id>                                # remove locally (+ guided Raycast step)
rayget doctor                                     # check node/npm/git/Raycast/login
```

All commands accept `--json` for scripting (auto-enabled when piped).

## How it works

`rayget` clones each repo into `~/.rayget/cellar/`, runs `npm install`, and
registers the extension with the running Raycast app via `npx ray develop`
(terminated once it logs `built extension successfully`). Extensions installed
this way are *local/development* extensions and are never auto-updated by the
Store — `rayget upgrade` updates them on demand. See
[the design spec](docs/specs/2026-06-05-rayget-design.md).
