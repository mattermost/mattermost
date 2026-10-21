---
name: show-spec-working
description: Use when the user asks "show me X", "demo X", "walk me through X", "how X works" or requests a live feature demonstration from a spec, feature or ticket.
author: LIDR.co
version: 1.0.0
---

# show-spec-working Skill

Demonstrate a spec in a runnable way.

If the user does not provide explicit context, use the spec/change currently being worked on in this session.

Always end by reporting completion in chat.

## Trigger phrases (high priority)

Treat these expressions as execution commands, not analysis requests:

- `show me X`
- `demo X`
- `walk me through X`
- `show X working`
- `how X works`
- `prove X works`

When any of these appear, run the demonstration workflow directly.
Do not stop at a feature summary or quick report.

## Inputs

- Optional spec context from user:
  - Direct ticket id in text (for example: `SCRUM-10`)
  - Feature name
  - Endpoint
  - Frontend route
- If missing, infer from current session context and currently active work.

## Workflow

### Step 1 - Resolve target spec and scope

1. Identify the target spec/change:
   - Prefer explicit user-provided context.
   - If user text contains a ticket id pattern like `[A-Z]+-[0-9]+`, use it as primary context (example: `show me SCRUM-10`).
   - Otherwise, infer the spec currently being worked on.
2. Determine modality:
   - `frontend` when the spec includes UI behavior.
   - `backend-only` when it only defines API behavior.
   - `mixed` when both exist.
3. List concrete scenarios to demo from the spec acceptance criteria.

### Step 1.1 - Anti-report guardrail

Before continuing, enforce this rule:

- Never finish after only analyzing requirements.
- Never return only a quick report when the user asked to "show" or "demo".
- If execution is blocked, explicitly report the blocker and ask for exactly what is needed to continue the live demo.

### Step 2 - Frontend demonstration path

Run this path when modality is `frontend` or `mixed`.

1. Start required local services if needed.
2. Use browser automation to open the app and navigate to the target feature.
3. Demonstrate feature behavior from the spec, one interaction at a time.
   - Example sequence for list/table features:
     - Open listing page
     - Verify table data appears
     - Use search box
     - Apply filters
     - Change sorting
     - Open details view
4. After each meaningful action:
   - Verify visible result matches spec expectations.
5. Stop on a stable end state and let the user continue manual exploration or close the window.
6. Keep the browser open unless the user asks to close it.

### Step 3 - Backend API demonstration path

Run this path when modality is `backend-only` or `mixed`.

1. Identify the endpoint(s) and sample payload(s) defined by the spec.
2. Execute curl command(s) that show real response behavior.
3. If any call changes data state (CREATE/UPDATE/DELETE):
   - Execute the paired restore/reset curl command (or equivalent restore action) immediately after demonstrating the behavior.
4. Confirm restored state so repeated demos remain deterministic.
5. Include command and key response evidence in chat (concise).

## Browser MCP requirements

Before calling any MCP browser tool:

1. Read the MCP tool descriptor JSON first.
2. Follow the server instructions for lock/unlock and snapshot-refresh workflow.
3. Avoid repeated blind retries; if blocked, report blocker and best next action.

## API demo requirements

- Use explicit `curl` commands (not pseudocode) whenever environment data is available.
- Mask sensitive values in chat output.
- Keep commands idempotent when possible.
- Include restore commands for any state-changing operation.

## Completion contract

Always send a final chat message containing:

1. Target spec/change demonstrated.
2. What was executed:
   - Frontend flows shown.
   - Backend curl commands executed.
3. Verification result per demonstrated scenario (pass/fail with short note).
4. Data restore status (if applicable).
5. Final handoff:
   - "Demo complete. You can continue checking in the open browser window or ask me to close it."

## Output format

Use this concise structure in the final chat response:

```markdown
Spec demo completed for: <spec/change>

Frontend walkthrough:
- <step/result>

Backend API walkthrough:
- <curl + key response note>

Data restore:
- <restored / not needed / failed + reason>

Next:
- You can continue in the open browser window, or ask me to close it.
```
