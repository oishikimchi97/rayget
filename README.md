# rayget

**Install Raycast extensions that were never published to the Store — straight
from a GitHub URL.** Think `brew install`, but for unpublished Raycast
extensions.

```bash
rayget add https://github.com/owner/cool-extension
# → cloned, built, and now searchable in Raycast ✨
```

`rayget add` / `list` / `upgrade` / `remove` give you a tidy package-manager
workflow for the extensions you'd otherwise have to clone and build by hand.

---

## Why does this exist?

Tons of great Raycast extensions never make it to the official Store. To use one
today you have to: clone the repo → `npm install` → `npm run dev` → keep a dev
window open → and repeat the whole thing by hand whenever it updates. There's no
list of what you installed and no easy way to update.

Raycast's own `ray` CLI only has `build` / `develop` / `lint` / `publish` — there
is **no official install/list/upgrade/remove**. `rayget` fills that gap: it does
the clone-build-register dance for you and keeps a registry so you can update or
remove later with one command.

Extensions installed this way are **local/development extensions**: they live
under your control and are never silently auto-updated by the Store — you update
them when *you* want with `rayget upgrade`.

---

## Requirements

- **macOS** with the **Raycast app installed and running** (free account, logged
  in via Raycast)
- **Node.js 18+** and **npm**
- **git**

Not sure if you're set up? Run `rayget doctor` — it checks each of these and
tells you exactly what to fix.

---

## Install

rayget isn't on the npm registry yet, so install it **directly from GitHub**
(this builds it for you automatically):

```bash
npm i -g github:oishikimchi97/rayget
```

That's it — you now have a global `rayget` command. Verify with:

```bash
rayget --version
rayget doctor
```

<details>
<summary>Other ways to install</summary>

**Run once without installing** (npx):

```bash
npx github:oishikimchi97/rayget add owner/repo
```

**From a local clone** (for hacking on rayget itself):

```bash
git clone https://github.com/oishikimchi97/rayget
cd rayget
npm install        # builds automatically via the prepare script
npm link           # puts `rayget` on your PATH
```

</details>

> Once it's published to npm, `npm i -g rayget` will also work.

---

## Quick start

```bash
# 1. Make sure Raycast is running and your toolchain is healthy
rayget doctor

# 2. Install an extension from its GitHub repo
rayget add https://github.com/owner/cool-extension

# 3. See what you've installed
rayget list

# 4. Update it later (or update everything at once)
rayget upgrade owner/cool-extension
rayget upgrade --all

# 5. Remove it
rayget remove owner/cool-extension
```

After `add` finishes, just open Raycast and search for the extension — it's
already there.

---

## Commands

| Command | What it does |
|---------|--------------|
| `rayget add <url> [--ref <branch\|tag\|sha>] [--path <subdir>]` | Clone, build, and register an extension with Raycast |
| `rayget list [--offline]` | List installed extensions + whether an update is available |
| `rayget upgrade <id> \| --all` | Pull the latest commit of the recorded ref and re-register |
| `rayget remove <id>` | Remove it locally (see [Removing](#removing-an-extension)) |
| `rayget doctor` | Check Node/npm/git/Raycast and that `~/.rayget` is writable |
| `rayget --help` / `--version` | Help and version |

**Accepted URL forms for `add`:**

```bash
rayget add https://github.com/owner/repo                       # full URL
rayget add owner/repo                                          # shorthand
rayget add owner/repo --ref v1.2.0                             # pin a tag/branch/commit
rayget add owner/repo --path packages/ext                      # extension in a monorepo subdir
rayget add https://github.com/owner/repo/tree/main/packages/ext  # ref + subdir in one URL
```

The `<id>` used by `list` / `upgrade` / `remove` is just `owner/repo` (plus
`/subdir` for monorepos) — exactly what `rayget list` shows.

**Scripting:** every command supports `--json` for machine-readable output (it's
also auto-enabled when you pipe the output somewhere).

---

## Removing an extension

Raycast has no command-line way to unregister a local extension, so `rayget
remove`:

1. deletes the cloned source and drops it from rayget's registry, then
2. **tells you the one manual step** to finish the job:
   **Raycast → Settings → Extensions → _\<name\>_ → Remove.**

We'd rather be honest about that one click than silently leave a dangling
registration.

---

## How it works

`rayget` keeps everything under `~/.rayget/` (the "Cellar"):

```
~/.rayget/
  cellar/<owner>__<repo>/   # the cloned source (kept; Raycast builds from it)
  manifest.json             # registry of what you've installed
  rayget.log                # last-run log, handy for debugging
```

On `add`, it clones the repo, runs `npm install`, then registers the extension
with the running Raycast app via `npx ray develop` (which Raycast uses to import
dev extensions). It stops as soon as Raycast logs `built extension successfully`
and records the result in `manifest.json`. `upgrade` re-runs that flow against
the latest commit; `list` compares your installed commit to the remote to flag
updates.

See [the design spec](docs/specs/2026-06-05-rayget-design.md) for the full
rationale and trade-offs.

---

## Troubleshooting

- **`rayget doctor` says Raycast isn't running** — launch the Raycast app, then
  retry. Registration needs the app open.
- **`add` failed partway** — the clone is left in `~/.rayget/cellar/` for
  inspection, but nothing is added to the registry, so `rayget list` stays
  truthful. Check `~/.rayget/rayget.log` for the captured build output.
- **A private repo won't clone** — make sure `git` can authenticate to GitHub
  (e.g. you're logged in with the `gh` CLI or have an SSH/credential helper set
  up).

## License

MIT
