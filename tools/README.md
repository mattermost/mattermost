# Tools

This directory aims to provide a set of tools that simplify and enhance various development tasks. This README file serves as a guide to help you understand the directory, features of these tools, and how to get started using it. This is a collection of utilities and scripts designed to streamline common development tasks for Mattermost. These tools aim to help automate repetitive tasks and improve productivity.

## Included tools

* **mmgotool**: is a CLI to help with i18n related checks for the mattermost/server development.
* **sharedchannel-test**: integration test tool that validates shared channel synchronization (posts, reactions, membership) between two real Mattermost server instances.
* **bulk-insert-test**: generates a bulk-import zip sized to exceed PostgreSQL's 65,535 query parameter limit, imports it, and validates the results (MM-68076).

## Installation & Usage

### mmgotool

To install `mmgotool`, simply run the following command: `go install github.com/mattermost/mattermost/tools/mmgotool`

Make sure you have the necessary prerequisites such as [Go](https://go.dev/) compiler.

`mmgotool i18n` has following subcommands described below:

* `check`: Check translations
* `check-empty-src`: Check for empty translation source strings
* `clean-empty`: Clean empty translations
* `extract`: Extract translations

### sharedchannel-test

Stands up two Mattermost Enterprise instances, creates a remote cluster connection, and runs integration tests for shared channel synchronization (membership, posts, reactions).

**Prerequisites:**
- `make start-docker` (Postgres and friends running)
- Enterprise repo present at `../../enterprise`
- An enterprise license file

**Usage:**

```bash
# Managed mode (builds server, starts/stops both instances automatically)
cd tools/sharedchannel-test
go run . --license /path/to/license.mattermost-license --server-dir ../../server

# External mode (connect to already-running instances)
go run . --license /path/to/license.mattermost-license --manage=false \
  --server-a http://localhost:9065 --server-b http://localhost:9066
```

### bulk-insert-test

Generates a Mattermost bulk-import zip sized to exceed PostgreSQL's 65,535 query parameter limit across all bulk INSERT paths, imports it via mmctl, waits for the job to complete, and validates the results. Safe to run multiple times — each run creates unique users and a unique channel.

**Prerequisites:**
- Mattermost server running with local mode enabled
- `mmctl` binary available
- `MaxUsersPerTeam` setting high enough for the number of users (default 10,000)

**Usage:**

```bash
cd tools/bulk-insert-test

# Default: 10,000 users + 10,000 replies (exceeds all 4 overflow thresholds)
go run . -mmctl ../../server/bin/mmctl

# Custom sizes and team name
go run . -users 5000 -replies 3000 -team my-test-team -mmctl ../../server/bin/mmctl

# Custom timeout for slow environments
go run . -timeout 20m -mmctl ../../server/bin/mmctl
```
