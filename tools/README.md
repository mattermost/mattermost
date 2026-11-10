# Tools

This directory aims to provide a set of tools that simplify and enhance various development tasks. This README file serves as a guide to help you understand the directory, features of these tools, and how to get started using it. This is a collection of utilities and scripts designed to streamline common development tasks for Mattermost. These tools aim to help automate repetitive tasks and improve productivity.

## Included tools

* **mattermost-govet**: custom Go vet analyzers enforcing Mattermost-specific code conventions (structured logging, error handling, SQL safety, etc.). Used by `make vet` in the server.
* **mmgotool**: is a CLI to help with i18n related checks for the mattermost/server development.
* **sharedchannel-test**: integration test tool that validates shared channel synchronization (posts, reactions, membership) between two real Mattermost server instances.

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
