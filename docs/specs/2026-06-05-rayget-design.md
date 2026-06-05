# rayget — Design Spec

Date: 2026-06-05
Status: Draft (pre-implementation)

## 1. Problem & Goal

Raycast extensions that are **not published to the Raycast Store** can only be used
by manually cloning the repo, running `npm install`, and importing them into
Raycast (via `ray develop` or the GUI "Import Extension"). Updating means
repeating the steps by hand, and there is no inventory of what you installed
this way.

**Goal:** a Homebrew-style CLI that installs and manages *unpublished* Raycast
extensions **from a GitHub URL** — `rayget add <url>`, `rayget upgrade`,
`rayget list`, `rayget remove`.

Closest analogues: `cargo install --git`, `pipx install git+…`, and git-based
shell-plugin managers. It is **not** like Homebrew bottles — there are no
prebuilt artifacts, so each extension is **built from source** locally.

## 2. Non-goals

- Not a replacement for the official Store (published extensions keep using it).
- No auto-update daemon (updates are explicit, like `brew upgrade`).
- No Windows support in v1 (Raycast macOS first; keep paths abstracted).
- Not publishing extensions (that's `ray publish`).

## 3. Key constraints (from research)

These shaped the design and are non-negotiable facts about Raycast:

1. **No `ray import`/`install` command.** A local extension is registered with
   the running Raycast app only via:
   - `ray develop` (dev watcher; registers on first build), or
   - `ray build` (env `dev`, the default) — **verified to run one-shot and exit
     0**; used by the app's dev pipeline, or
   - the GUI **"Import Extension"** command.
2. Extensions registered this way are **"local/development extensions"** —
   user-managed and **never auto-updated by the Store** (exactly the behavior we
   want).
3. Installed extensions live under
   `~/Library/Application Support/com.raycast.macos/extensions/<uuid>/`, with
   metadata in an **encrypted SQLite DB**. **Direct file/DB injection is
   unsupported and fragile** → we must go through `ray`.
4. Registration requires the **Raycast app to be running** and the user to be
   **logged in** (`ray login`, free account).
5. Building requires a **Node.js toolchain** and a per-extension `npm install`.

### Open question carried into implementation

- **First-time registration:** `ray build -e dev` is confirmed one-shot for an
  *already-registered* extension. Whether it also performs *first-time*
  registration with the app (vs. requiring `ray develop` once) must be verified
  on a fresh extension during Milestone 1. **Default assumption:** use
  `ray develop` and terminate it once it logs `built extension successfully`
  (proven to register); switch to `ray build` if M1 proves it registers
  first-time too.
- **Programmatic removal:** there is no `ray uninstall`. Removing a local
  extension cleanly may require the Raycast GUI ("Manage Extensions"). See §7.

## 4. Architecture

```
~/.rayget/                         # the "Cellar"
  cellar/<owner>__<repo>[__<sub>]/ # cloned source, kept (Raycast points at the build)
  manifest.json                    # registry of installed extensions
  rayget.log                       # last-run log for debugging
```

`manifest.json` entry:

```json
{
  "version": 1,
  "extensions": {
    "<id>": {
      "id": "owner/repo[/sub]",
      "name": "wandb",
      "title": "Weights & Biases",
      "url": "https://github.com/oishikimchi97/wandb-raycast",
      "ref": "master",
      "commit": "e27838d…",
      "path": "cellar/oishikimchi97__wandb-raycast",
      "extensionRoot": ".",
      "installedAt": "2026-06-05T…Z",
      "updatedAt": "2026-06-05T…Z"
    }
  }
}
```

`id` = `owner/repo` plus an optional subdir for monorepos. It is the stable key
for `upgrade`/`remove`.

## 5. CLI surface

```
rayget add <github-url> [--ref <branch|tag|sha>] [--path <subdir>]
rayget list
rayget upgrade [<id> | --all]
rayget remove <id>
rayget doctor
rayget --help / --version
```

### `rayget add <url>`

1. **Parse** the URL into `{host, owner, repo, ref?, subdir?}`. Accept:
   - `https://github.com/owner/repo`
   - `https://github.com/owner/repo/tree/<ref>/<subdir>` (monorepo path)
   - `owner/repo` shorthand
   - explicit `--ref` / `--path` override the parsed values.
2. **Clone** into `cellar/<owner>__<repo>[__<sub>]` (`git clone`, then
   `git checkout <ref>` if given). Re-add of an existing id → fast-forward or
   error with a hint to use `upgrade`.
3. **Locate the extension root**: the dir (root or `--path`) whose
   `package.json` has the Raycast manifest schema
   (`$schema: …/extension.json` and a `commands` array). Error clearly if none.
4. **Install deps**: `npm install` (prefer `npm ci` when a lockfile exists).
5. **Register with Raycast** (the crux): run the registration command (see §6)
   from the extension root; stream output to `rayget.log`; succeed when it logs
   `built extension successfully`.
6. **Record** the entry in `manifest.json` (resolve `commit` via
   `git rev-parse HEAD`).
7. Print: extension title, source, and "Now searchable in Raycast" hint.

### `rayget list`

Table from `manifest.json`: id, title, ref, short commit, installed date,
"update available?" (compare `git ls-remote`/local vs recorded commit — cheap,
network-optional with `--offline`).

### `rayget upgrade [<id> | --all]`

For each target: `git fetch && git checkout <ref> && git pull` (or reset to
remote ref), `npm install`, re-register (§6), update `commit`/`updatedAt`.
No-op (with message) when already at the latest commit.

### `rayget remove <id>`

1. Best-effort unregister from Raycast (§7).
2. Delete the cellar dir.
3. Drop the manifest entry.
4. If programmatic unregister is not possible, **tell the user the exact GUI
   step** ("Raycast → Settings → Extensions → <title> → Remove") rather than
   leaving a silent dangling entry.

### `rayget doctor`

Checks and reports actionable fixes for: `node`/`npm` present and version,
`git` present, Raycast app installed and running, `ray login` state,
`~/.rayget` writable.

## 6. Registration mechanism (the crux)

Primary (proven): from the extension root,

```bash
npx ray develop      # registers + builds; terminate on "built extension successfully"
```

`rayget` spawns it, watches stdout for the success line, then sends SIGINT and
treats exit as success. Timeout (default 180s) → fail with the captured log.

Optimization (pending M1 verification): if `npx ray build` (env `dev`) is shown
to register first-time too, use it instead — it exits 0 on its own and needs no
watch/kill, which is simpler and more robust.

Pre-flight before either: assert Raycast is running and `ray` is logged in
(reuse `doctor` checks); fail fast with guidance otherwise.

## 7. Removal strategy (the rough edge)

There is no `ray uninstall`. Options, in preference order, to be settled in M1:

1. **Deeplink/CLI**, if one exists for removing a dev extension (investigate
   `raycast://` schemes). Cleanest if available.
2. **Best-effort + guided GUI**: delete cellar + manifest entry, then instruct
   the user to remove it in Raycast Settings. Safe and honest.
3. **DB manipulation**: rejected — the metadata DB is encrypted and unsupported.

v1 ships option 2 unless M1 finds option 1.

## 8. Tech stack

- **Node.js CLI** (TypeScript), distributed via `npm i -g rayget` / `npx rayget`.
  Rationale: Node + `npx ray` are already hard dependencies, so requiring Node
  adds nothing; it keeps install trivial and reuses the same toolchain.
- Shell out to `git`, `npm`, and `npx ray` via `execa` (or `node:child_process`).
- Minimal deps: a small arg parser, `execa`, `chalk` for output. No heavy
  framework.
- Single responsibility modules: `url-parse`, `cellar` (clone/update),
  `registrar` (ray interaction), `manifest` (read/write), `commands/*`.

## 9. Error handling & UX

- Every failure prints the failing step + the tail of `rayget.log` + a next
  action. Exit codes: 0 ok, 1 generic, 2 usage, 3 environment (Node/Raycast),
  4 git/network, 5 registration.
- `add` is transactional-ish: on failure after clone, leave the cellar dir for
  inspection but do **not** write a manifest entry (so `list` stays truthful).
- Non-TTY / `--json` output for scripting.

## 10. Testing

- **Pure units** (vitest): URL parser (all URL shapes + monorepo paths),
  manifest read/write/migrate, extension-root detection from a fixture tree.
- **Registrar**: mock the `ray` spawn; assert success-line detection, timeout,
  and SIGINT-on-ready behavior.
- **Integration (manual / opt-in)**: a smoke test that `add`s a known small
  public extension repo and asserts it appears (gated behind an env flag since
  it needs Raycast running).

## 11. Milestones

- **M1 — De-risk (spike):** confirm first-time registration command
  (`ray develop` kill vs `ray build -e dev`) and the removal path on a real
  fresh extension. Outcome updates §6/§7. *Blocking.*
- **M2 — Core add/list:** URL parse → clone → npm install → register → manifest;
  `list`. Ship `add`/`list`/`doctor`.
- **M3 — Lifecycle:** `upgrade` (single + `--all`) and `remove`.
- **M4 — Polish:** `--json`, update-available detection, README, npm publish.
- **M5 — (optional) Taps:** curated registries of URLs (a JSON "tap" file) so
  `rayget add <shortname>` resolves to a known repo, mirroring `brew tap`.

## 12. Risks

- **First-time registration** may require `ray develop` (handled) — worst case
  is the kill-on-ready dance, already specced.
- **Removal** may stay GUI-assisted in v1 (§7 option 2) — acceptable, honest.
- **Raycast internals can change** (the dev-extension pipeline is not a stable
  public contract). Mitigate by depending only on documented `ray` commands and
  failing loudly if their output contract changes.
- **Node toolchain friction** for end users — documented as a prerequisite;
  `doctor` guides setup.
