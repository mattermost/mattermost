# Performing an agent task by hand (a person, or any chat tool)

This is the `--agents=manual` path. It needs no command template and no vendor tool. A person, or any chat or coding tool you paste into, reads a task file and produces one result file. The orchestrator validates the file; you do not have to trust yourself or the tool.

## 1. Produce a pending task

```bash
node explorer-proto/v2/orchestrator/pilot.mjs run --target main --feature channels.favorites --agents=manual --out /tmp/pilot-out
```

The run stops with exit code 20 and prints the task path and the result path, for example `/tmp/pilot-out/4-select/agent-task.json` and `/tmp/pilot-out/4-select/agent-result.json`. Add `--dry-run` (the default) to plan without any Docker.

## 2. Build the prompt

```bash
node explorer-proto/v2/agents/providers/cmd-wrapper.mjs --task /tmp/pilot-out/4-select/agent-task.json --result /tmp/pilot-out/4-select/agent-result.json --print-prompt > /tmp/pilot-prompt.md
```

The prompt holds the contract, the role file, the orchestrator's prompt, the small inputs inline, the paths of the large ones, and the result schema. The command also refuses a task whose inputs the role must not see, and a task that is stale. If you prefer not to use it, open the task file and read, in this order: `explorer-proto/v2/agents/CONTRACT.md`, the role file that `explorer-proto/v2/agents/roles/index.json` maps the task's `role` to, the prompt file named in the task, and every input it lists.

## 3. Do the task

Give the prompt to the person or tool. Tell it plainly:

- Read only the listed inputs and the repository. Do not open anything the role must not see.
- Never paste, print or look for `MM_LICENSE` or any credential. Do not run a command from the list in `CONTRACT.md`.
- Reply with one JSON object that echoes the task's `task_id`. No screenshots, no routes, no origins or ids.

## 4. Drop the result

Save the JSON as the result path from step 1 (`agent-result.json`, or `agent-result.<name>.json` when the task file is `agent-task.<name>.json`). To validate and write it with the same checks the wrapper uses, pipe it through a command that prints it:

```bash
node explorer-proto/v2/agents/providers/cmd-wrapper.mjs --task /tmp/pilot-out/4-select/agent-task.json --result /tmp/pilot-out/4-select/agent-result.json -- cat /tmp/my-answer.json
```

Exit 0 means the result file was written and is valid. Exit 1 means it was refused: the error lines give JSON paths and rules, never your data. Fix the answer and run it again.

## 5. Resume

```bash
node explorer-proto/v2/orchestrator/pilot.mjs run --resume --out /tmp/pilot-out
```

The orchestrator validates the result against the task's schema and continues. It stops again with exit 20 at the next task (a second `select` task named `review`, then `verify`, then `lessons`). Exit 21 means the result was invalid or stale and was set aside; the errors are in `agent-result.errors.json`. Repeat until the run finishes.

## Rules that never change

- The result is advisory. A failing or blocked deterministic gate stays failing or blocked whatever you write.
- Report blocked, not reproduced, cannot tell and budget exhausted when that is true.
- A person decides every item under "Human approval points" in `CONTRACT.md`.
