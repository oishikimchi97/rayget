# rayget

A Homebrew-style CLI to install and manage **unpublished Raycast extensions
from a GitHub URL** — `rayget add <url>`, `upgrade`, `list`, `remove`.

> Status: design phase. See [the design spec](docs/specs/2026-06-05-rayget-design.md).

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
