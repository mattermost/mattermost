# Role: infra-owner

Work-package role; no orchestrator task. The infra owner is a person or an agent session briefed to change the offline stack and seeds under `explorer-proto/infra/`: the Compose file, the loopback forwarder, the isolation and licence gate, the seed and its variants, the read-back, the leak scanner and teardown.

## Purpose

Provide an isolated, deterministic stack that a fresh replay can rely on: pinned images, no published ports, a seed that is the same every time, a read-back that proves it, and teardown that leaves nothing behind. The licence reaches the server by name only.

## Inputs

- The brief from the lead, `explorer-proto/infra/README.md`, `explorer-proto/infra/INTERFACE.md`, and the scripts under `explorer-proto/infra/scripts/`.
- The fixture a charter declares (names, memberships, preferences, viewed-last order, negative control) and the target records in `explorer-proto/v2/targets/`.

## Outputs

- Changes under `explorer-proto/infra/` only, with the seed read-back (`verify_seed.mjs`) and the leak scan reported as PASS or FAIL.
- Interface notes for the engine owner and the orchestrator when a flag, variant or path changes.

## Allowed tools

Read the repository, edit the paths above, run scripts that need no Docker (syntax checks, read-back unit checks). A live stack is started by a person who exports `MM_LICENSE`; the scripts check it by name only.

## Forbidden actions

- Pulling or downloading an image. Images are pinned by digest, and Compose runs with `--pull never`.
- Publishing a port, leaving the internal network, or binding the forwarder to anything but loopback.
- Reading, printing, hashing or writing `MM_LICENSE`; running any command that exposes it (`docker compose config`, `docker inspect` without a narrow format, `docker exec ... env`, `set -x` around the scripts).
- Changing seed data in a way that changes names, URLs, membership or accessible names in a negative-control variant.
- Editing the engine, gates, schemas, the bakeoff files, or the orchestrator.

## Checklist

- [ ] Image references in `explorer-proto/infra/scripts/lib.sh` carry digests, and a target file that names a different digest stops the script.
- [ ] The seed is deterministic and idempotent, and ends with the viewed-last calls in the declared order; a read-back confirms zero unread and zero mentions for the actor.
- [ ] Any write that posts a message (a purpose or header patch, a membership change) is followed by viewing the affected channels again in seed order.
- [ ] A negative control changes one condition and is restored and read back. Before relying on a config change, check that the server's own validation accepts it; if it refuses, report BLOCKED.
- [ ] A fresh stack per replay for the stability runs, and teardown that removes volumes and the seed manifest.
- [ ] Link bookmarks use an absolute URL built from the manifest at seed time; the origin never reaches a spec.
- [ ] The licence check prints `PASS` or `FAIL` only. An unlicensed server is a setup failure, never a different edition.
- [ ] The leak scan runs over logs, committed files and the names in the storage-state directory (names only), and its result is reported.
- [ ] Storage-state cleanup removes only entries created by the run.
- [ ] Write what you did not run (no Docker means every live path is unverified).

## Failure modes seen in earlier pilots

- A seed variant with swapped purpose and header made six soft assertions wait 10 seconds each and ended in a location-less timeout, so it left the gate. See `explorer-proto/README.md` ("Exploratory only") and `explorer-proto/infra/INTERFACE.md`.
- A purpose patch posted a system message, the channel became unread, and the exact-name sidebar click timed out until both channels were viewed again. See `explorer-proto/coverage.md` (section 5.1) and `explorer-proto/infra/scripts/verify_seed.mjs`.
- A config patch that the server refuses (`ThreadAutoFollow=false` while collapsed threads are on) blocked a planned control. See `explorer-proto/sessions/auto-follow/QA-NOTES.md` (section 2).
- Replays on a server that earlier runs had written to differ from a fresh seed (the channel intro and the unread state change). See `explorer-proto/v2/bakeoff/PREREGISTRATION.md` (section 5, step 3).
- The Info panel button name carries an icon glyph on one image and not on the other, so seeds and probes cannot assume one name across targets. See `explorer-proto/infra/INTERFACE.md` (name survey).
- A shell is not available in the pinned main image, so a no-op `docker exec` fails; use the documented local mmctl form. See `explorer-proto/infra/INTERFACE.md`.

## What you must NOT see

- The licence value, an environment dump, the contents of `explorer-proto/infra/.run/` logs outside the leak scan, and the contents of storage-state files (names only).
- The sealed route of any journey, and the pre-registered bakeoff rules (`explorer-proto/v2/bakeoff/rules.json`).

The wrapper refuses a task whose inputs match these (`roles/index.json`).
