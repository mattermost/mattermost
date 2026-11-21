# Codex: `--agents=cmd:` templates

Status: **unverified.** No Codex program was run to write this page. The templates show the required shape; the two placeholders must be filled from the tool's own current documentation.

| Placeholder | Fill it with |
| --- | --- |
| `<CODEX_CLI>` | How the Codex command-line program is invoked on your machine. |
| `<NON_INTERACTIVE_FLAGS>` | The flags, options or subcommand that make it run one prompt without a human, print the answer and exit. **Check the current CLI documentation** (its help output and docs); flags change between versions and none are written here on purpose. Add the options that restrict it to read-only tools plus, for template B, one write to the result path. |

## What a template must do

- Read the task: `{task}` is the absolute path of `agent-task.json`.
- Write the result: `{result}` is the absolute path of `agent-result.json`. Template A and C let the wrapper write it.
- Exit codes: exit **0 only after a valid result file exists**. Any non-zero exit, a timeout or an invalid result is one failed attempt. When the retry cap is reached the stage fails: **exit 22** if the command never ran cleanly; if it ran but its results were invalid the stage ends with `retries_exceeded` (exit 1) and the last invalid file is set aside with its errors. Exit 21 belongs to a manually dropped result that was invalid or stale. Through the wrapper a refused result is a non-zero exit, so a tool that keeps producing refused results ends the stage with exit 22; the wrapper's stderr says why (JSON paths and rules only).
- The orchestrator removes `MM_LICENSE` from the command's environment and runs it from the repository root. The wrapper removes it again before it starts your tool.

## Template A: through the wrapper (recommended)

The wrapper builds the prompt from the contract, the role file and the task, runs your tool with the prompt on stdin, validates what the tool prints, and writes the result. The tool needs no write permission.

```bash
node explorer-proto/v2/orchestrator/pilot.mjs run --target main --feature channels.favorites --dry-run \
  --agents='cmd:node explorer-proto/v2/agents/providers/cmd-wrapper.mjs --task {task} --result {result} -- <CODEX_CLI> <NON_INTERACTIVE_FLAGS>' \
  --out /tmp/pilot-out
```

If the tool takes the prompt from a file or an argument instead of stdin, use template C.

## Template B: direct, no wrapper

The tool reads the task and writes the result itself. The orchestrator still validates the result, but nothing checks the role's input deny-list, so give the tool only the read access it needs.

```bash
node explorer-proto/v2/orchestrator/pilot.mjs run --target main --feature channels.favorites --dry-run \
  --agents='cmd:<CODEX_CLI> <NON_INTERACTIVE_FLAGS> "Perform the agent task described in {task}. Follow explorer-proto/v2/agents/CONTRACT.md and the role file that explorer-proto/v2/agents/roles/index.json maps the task role to. Write the JSON result to {result}."' \
  --out /tmp/pilot-out
```

## Template C: prompt from a file

`{prompt_file}` is replaced by the path of a temporary file that holds the prompt and is deleted afterwards.

```bash
  --agents='cmd:node explorer-proto/v2/agents/providers/cmd-wrapper.mjs --task {task} --result {result} -- <CODEX_CLI> <NON_INTERACTIVE_FLAGS> {prompt_file}'
```

## Check the plumbing before you use the tool

Replace `<CODEX_CLI> <NON_INTERACTIVE_FLAGS>` with `node explorer-proto/v2/agents/providers/fake-agent.mjs` to run the whole dry pipeline against canned answers (no vendor program, no network):

```bash
node explorer-proto/v2/orchestrator/pilot.mjs run --target main --feature channels.favorites --dry-run \
  --agents='cmd:node explorer-proto/v2/agents/providers/cmd-wrapper.mjs --task {task} --result {result} -- node explorer-proto/v2/agents/providers/fake-agent.mjs' \
  --out /tmp/pilot-out
```

`selftest.mjs` runs exactly this.

## Permissions to give the tool

- Read access to the repository and the run directory. Nothing outside them.
- With A or C: no write access. With B: one write, to the result path.
- No Docker, no shell, no network, no environment dump, no package or browser install.
- It must never see `MM_LICENSE`. Do not export it in the shell that starts the tool for a judgement task.

## Not verified

The real tool's behaviour: whether it reads the prompt from stdin, prints only the JSON, honours its read-only options, and exits 0 on success. Run one task by hand first (`run-manual.md`), then a dry run with template A.
