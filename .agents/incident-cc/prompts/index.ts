// Prompt builders for the 5-agent SDK workflow.
//
// The workflow is ticket-agnostic: a Cursor Automation (or manual `npm start`)
// supplies the ticket via env (TICKET_ID, TICKET_TITLE, TICKET_URL,
// TICKET_DESCRIPTION, optional TICKET_SLUG). If those env vars are missing,
// the orchestrator falls back to the YVETTE-2 defaults so the original
// Incident Command Center test case keeps working.

export interface Ticket {
    id: string;
    url: string;
    title: string;
    description: string;
    /** kebab-case identifier used in doc paths, commit scopes, and report file names. */
    slug: string;
}

const DEFAULT_TICKET: Ticket = {
    id: "YVETTE-2",
    url: "https://linear.app/anysphere/issue/YVETTE-2",
    title: "Add Incident Command Center",
    slug: "incident-command-center",
    description: `When a channel is marked as an incident channel, users should be able to open a new "Incident Command Center" side panel from the channel header.

The panel should display:
- Incident title
- Severity (Critical, High, Medium, Low)
- Current status (Investigating, Mitigating, Monitoring, Resolved)
- Incident owner
- Timeline of incident events (timestamp, actor, event description)
- Checklist of incident tasks (completed / incomplete)

Requirements:
- Add an "Open Incident Command Center" action to the channel header.
- Implement the Command Center as a right-hand side (RHS) panel following Mattermost design patterns.
- Provide empty states for channels without incident data.
- Match existing Mattermost spacing, typography, theming, and i18n conventions.
- Light and dark theme support.
- Include unit tests for key components.

Acceptance Criteria:
- Users can open the Incident Command Center from an incident channel.
- Incident metadata, timeline, and tasks are displayed in a single panel.
- The panel is responsive and supports light and dark themes.
- All new components have passing tests.`,
};

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}

/** Reads ticket info from environment variables, falling back to YVETTE-2 defaults. */
export function ticketFromEnv(): Ticket {
    const id = (process.env.TICKET_ID || DEFAULT_TICKET.id).trim();
    const url = (process.env.TICKET_URL || DEFAULT_TICKET.url).trim();
    const title = (process.env.TICKET_TITLE || DEFAULT_TICKET.title).trim();
    const description = process.env.TICKET_DESCRIPTION ?? DEFAULT_TICKET.description;
    const explicitSlug = process.env.TICKET_SLUG?.trim();
    const slug = explicitSlug
        ? slugify(explicitSlug)
        : id === DEFAULT_TICKET.id
          ? DEFAULT_TICKET.slug
          : slugify(id);
    return { id, url, title, description, slug };
}

function sharedContext(t: Ticket): string {
    return `## Linear ticket
- ID: ${t.id}
- URL: ${t.url}
- Title: ${t.title}

### Description
${t.description}

## Repository conventions (must follow)
- Read .cursor/rules/mattermost-core.mdc, AGENTS.md, and any AGENTS.md files in the directories you intend to modify before making changes.
- Minimize diff scope; match the patterns and naming of neighboring files.
- For server changes: do NOT run \`go mod tidy\` (use \`make modules-tidy\` from server/).
- After editing server/i18n/en.json, run \`make i18n-extract\` from server/.
- No secrets, no .env, no credentials committed.
- Pull-request body must follow .github/PULL_REQUEST_TEMPLATE.md and include a \`release-note\` fenced block.

## Artifact convention
Per-ticket planning, design, and review docs live under \`docs/cursor-agents/${t.slug}/\`. Code changes go in the natural locations dictated by the ticket (e.g. \`webapp/channels/src/\` for webapp work, \`server/...\` for server work).

## Handoff convention
You are running as a LOCAL SDK agent. The orchestrator has already created and checked out the feature branch (env: \`BRANCH_NAME\`). All five role agents share this branch and working tree. When you finish your work, stage and commit with git from the repo root:
\`\`\`
git add -A
git commit -m "<conventional message>"
\`\`\`
Do NOT push the branch yourself unless you are the Release Engineer; the Release Engineer is responsible for pushing and opening the PR.

End your final message with the exact marker line documented in your role prompt so the orchestrator can detect completion.`;
}

export function plannerPrompt(t: Ticket): string {
    return `You are **Agent 1: Planner** in a 5-agent workflow shipping the Linear ticket below to the Mattermost monorepo. You must NOT write production code; you produce a planning document only.

${sharedContext(t)}

## Your responsibilities
1. Read .cursor/rules/mattermost-core.mdc, AGENTS.md, and any nested AGENTS.md files in the directories the ticket touches.
2. Identify the affected areas of the codebase from the ticket description. Use ripgrep / glob to find the relevant existing code paths and patterns to model after. For UI work, look at \`webapp/channels/src/\`; for server work, \`server/\`. For shared/reusable bits, also check \`webapp/platform/\`.
3. If the ticket implies a domain concept (e.g. a new entity, a new permission, a new feature flag), define how that concept gates code paths and document the assumption.
4. Define the data model (TypeScript types and/or Go structs) for any new entities.
5. Define the component / package hierarchy if there is new UI or new modules.
6. List every file you expect Agent 3 (Implementer) will create or modify, with a one-line reason each.
7. Identify accessibility, i18n, theming, and responsive-behavior requirements for any UI work.
8. Define the testing strategy and which components / packages require unit tests (Jest + RTL for webapp; \`go test\` for server).
9. Identify risks and assumptions explicitly. If the ticket is ambiguous, document the assumption you made and proceed.

## Deliverable
Create \`docs/cursor-agents/${t.slug}/implementation_plan.md\` with these sections, in this order:

\`\`\`
# ${t.id} - ${t.title}: Implementation Plan

## 1. Overview
## 2. User flow (step-by-step)
## 3. Architecture overview
   ### 3.1 Component / module hierarchy
   ### 3.2 State, actions, selectors (or server-side equivalents)
   ### 3.3 Data model (types / structs)
## 4. UI entry points (if applicable)
## 5. Files likely to be created or modified
## 6. i18n, theming, accessibility, responsive behavior (if applicable)
## 7. Testing strategy
## 8. Risks and assumptions
## 9. Ordered implementation tasks (numbered)
\`\`\`

## Finish steps
1. \`git add docs/cursor-agents/${t.slug}/implementation_plan.md\`
2. \`git commit -m "docs(${t.slug}): add ${t.id} implementation plan"\`
3. End your final message with the exact line:
   \`PLANNER_COMPLETE: docs/cursor-agents/${t.slug}/implementation_plan.md\`

Do NOT modify any source code under webapp/ or server/. Plan only.`;
}

export function designerPrompt(t: Ticket): string {
    return `You are **Agent 2: Product Designer** in the 5-agent workflow. You must NOT write production code.

${sharedContext(t)}

## Inputs (already on this branch, read them first)
- \`docs/cursor-agents/${t.slug}/implementation_plan.md\` (from the Planner).

## Your responsibilities
The Figma MCP server has been attached to this agent (server name: \`figma\`). If those tools are reachable, USE THEM to create a real Figma file with frames for the feature; if they are not reachable for any reason (auth failure, network), proceed with a high-fidelity textual spec only and note the failure in section 9 of the deliverable. Do not block on Figma.

If the ticket has no UI surface (pure server / infra work), state that in section 1 of the deliverable, skip Figma, and produce a short data-shape / API-shape document instead. Do not invent UI work that the ticket does not require.

If Figma MCP is reachable AND the ticket has a UI surface:
1. Use \`create_new_file\` to create a Figma design file titled "${t.id} - ${t.title}".
2. Use \`get_libraries\` / \`search_design_system\` to discover existing component / token primitives, then \`use_figma\` to assemble frames for every distinct UI surface in the ticket. Include light theme and dark theme variants.
3. Capture the Figma file URL and node IDs for each frame in section 9 of the deliverable.
4. Follow the figma-use / figma-generate-design skill conventions (assemble section-by-section, use design tokens not hex codes).

Whether or not Figma MCP is reachable, produce the textual design spec below.

1. Read the implementation plan and the ticket carefully.
2. Inspect existing Mattermost UI patterns relevant to the ticket. Look at \`webapp/channels/src/sass\` / \`webapp/channels/src/components\` for SCSS conventions and reusable components.
3. Define the design for every UI surface in the ticket (panels, modals, dropdowns, badges, lists, empty states, error states, loading states).
4. Cover: light and dark theme tokens, responsive behavior, interaction states, accessibility (ARIA, keyboard nav, focus order).
5. Include ASCII wireframes for every distinct surface.

## Deliverable
Create \`docs/cursor-agents/${t.slug}/design_spec.md\` with these sections:

\`\`\`
# ${t.id} - ${t.title}: Design Spec

## 1. Scope (UI surfaces this ticket affects; state explicitly if none)
## 2. Layout decisions (widths, sections, spacing)
## 3. Visual tokens (colors, spacing, typography - referencing existing Mattermost SCSS variables)
## 4. Components
## 5. Interaction states (hover, focus, pressed, loading, error)
## 6. Accessibility (ARIA, keyboard nav, focus order, screen reader)
## 7. Responsive behavior
## 8. Light / dark theme matrix
## 9. ASCII wireframes
## 10. Figma references
   - If Figma MCP was reachable: list the file URL plus a table of frame name -> node ID for every frame you created.
   - If Figma MCP was NOT reachable: state that explicitly and include the error you saw.
\`\`\`

## Finish steps
1. \`git add docs/cursor-agents/${t.slug}/design_spec.md\`
2. \`git commit -m "docs(${t.slug}): add ${t.id} design spec"\`
3. End your final message with:
   \`DESIGNER_COMPLETE: docs/cursor-agents/${t.slug}/design_spec.md\``;
}

export function implementerPrompt(t: Ticket): string {
    return `You are **Agent 3: Implementation Engineer** in the 5-agent workflow. This is the only agent that writes production code.

${sharedContext(t)}

## Inputs (already on this branch, read them first)
- \`docs/cursor-agents/${t.slug}/implementation_plan.md\` (Planner)
- \`docs/cursor-agents/${t.slug}/design_spec.md\` (Designer)

## Your responsibilities
1. Implement the feature per the plan and design.
2. Follow Mattermost patterns. Reuse existing components, utilities, and packages wherever possible.
3. Add unit tests for new code paths (Jest + RTL for webapp; \`go test\` for server).
4. Wire up everything the plan calls for: UI entry points, state/actions/selectors, types, i18n strings in server/i18n/en.json, SCSS that respects theme variables, server endpoints if needed.
5. If the ticket implies a feature gate (channel flag, feature flag, permission), implement it defensively so code paths are inert when the gate is off.
6. Provide empty / loading / error states for any UI you add.

## Quality gates (run them, fix what you can)
Working from the repo root:
- \`cd webapp && npm install\` (if you touched webapp)
- \`cd webapp && npm run check-types\` (or the project's typecheck script)
- \`cd webapp && npm run test -- --watchAll=false <paths>\` for your new tests
- \`cd webapp && npm run lint\` (or eslint on changed files)
- If you edited \`server/i18n/en.json\`, run \`cd server && make i18n-extract\`.
- For server changes: \`cd server && go test ./...\` scoped to packages you touched.

Use your judgement on which targets are realistic in this VM. Document any quality gate you could not run, and why, in the report.

## Deliverable
1. Production code under the natural locations (\`webapp/\`, \`server/\`, etc.).
2. \`docs/cursor-agents/${t.slug}/implementation_report.md\` with:

\`\`\`
# ${t.id} - Implementation Report

## Summary
## Files created
## Files modified
## Features implemented (mapped to acceptance criteria)
## Tests added (path + what each test covers)
## Quality gates run (typecheck / lint / unit tests / i18n-extract / go test) - command + result
## Deviations from plan or design (with reason)
## Known limitations / follow-ups
\`\`\`

## Finish steps
1. \`git add -A\`
2. \`git commit -m "feat(${t.slug}): <one-line summary> (${t.id})"\` (one well-titled commit; if you split, use additional conventional-commit messages with the same scope)
3. End your final message with:
   \`IMPLEMENTER_COMPLETE: docs/cursor-agents/${t.slug}/implementation_report.md\``;
}

export function reviewerPrompt(t: Ticket): string {
    return `You are **Agent 4: Reviewer** in the 5-agent workflow. You are the quality gate. You may make small style/lint fixes, but reject if there are substantive bugs or unmet acceptance criteria.

${sharedContext(t)}

## Inputs (already on this branch)
- \`docs/cursor-agents/${t.slug}/implementation_plan.md\`
- \`docs/cursor-agents/${t.slug}/design_spec.md\`
- \`docs/cursor-agents/${t.slug}/implementation_report.md\`
- All source changes made by Agent 3.

## Your responsibilities
1. Read all three docs.
2. Inspect every file Agent 3 created or modified (\`git diff master...HEAD --stat\` is a good starting point; then read each file).
3. Verify each acceptance criterion from the ticket is met. Be explicit per criterion.
4. Check for:
   - Missing edge cases (empty / loading / error states)
   - Accessibility regressions (ARIA, keyboard, focus) for UI work
   - i18n misuse (hardcoded English, missing FormattedMessage IDs)
   - Theme token misuse (raw hex codes vs CSS variables)
   - Test coverage gaps
   - Lint / type errors
   - Diff scope creep (changes unrelated to ${t.id})
5. Run the same quality gates the Implementer ran. Confirm they pass.

## Deliverable
Create \`docs/cursor-agents/${t.slug}/review_report.md\` with these sections:

\`\`\`
# ${t.id} - Review Report

## Verdict
**APPROVED** or **REJECTED** (exact word)

## Summary

## Acceptance criteria coverage
(one bullet per criterion: met / partial / missing)

## Findings
### Blocking issues (must fix before merge)
### Non-blocking suggestions

## Quality gates verification
(typecheck / lint / tests - command + result)

## Files reviewed
\`\`\`

## Finish steps
1. \`git add docs/cursor-agents/${t.slug}/review_report.md\` (plus any small style/lint fixes you applied)
2. \`git commit -m "docs(${t.slug}): add review report"\`
3. End your final message with one of:
   - \`REVIEWER_VERDICT: APPROVED\`
   - \`REVIEWER_VERDICT: REJECTED\`

Be honest. If acceptance criteria are not met, REJECT.`;
}

export function releasePrompt(t: Ticket): string {
    return `You are **Agent 5: Release Engineer**. Reviewer already APPROVED this change. Your job is to land it.

${sharedContext(t)}

## Inputs (already on this branch)
- All artifacts from Agents 1-4 under \`docs/cursor-agents/${t.slug}/\`.
- All implementation code from Agent 3.
- \`docs/cursor-agents/${t.slug}/review_report.md\` with verdict APPROVED.

## Your responsibilities
1. Compose a clean conventional-commit message that summarizes the feature (use \`feat(${t.slug}): ...\` or \`fix(${t.slug}): ...\` as appropriate to the ticket).
2. Compose a PR title (short, imperative, includes the ticket ID).
3. Compose a PR description that follows \`.github/PULL_REQUEST_TEMPLATE.md\` exactly:
   - Remove ALL HTML comments.
   - Omit sections that are not applicable (do not write N/A; just remove the header).
   - Always include the \`#### Release Note\` header and a fenced \`\`\`release-note ... \`\`\` block. Use \`NONE\` if the change has no API / schema / UI / breaking changes; otherwise write a brief user-facing release note.
   - Include \`Resolves ${t.id}\` in the body (Linear-link convention from repo rules).
4. Create \`docs/cursor-agents/${t.slug}/release_report.md\` with:

\`\`\`
# ${t.id} - Release Report

## Branch
## Commit SHA(s)
## Commit message(s)
## PR title
## PR description (verbatim, no HTML comments, with the release-note block)
## Notes
\`\`\`

5. \`git add docs/cursor-agents/${t.slug}/release_report.md\` and \`git commit -m "docs(${t.slug}): add release report"\`.

6. **Push the branch.** The branch name is in the env var \`BRANCH_NAME\`. Push it to origin:
\`\`\`
git push -u origin "$BRANCH_NAME"
\`\`\`
If \`SKIP_PUSH_FLAG\` is \`1\` (set by the orchestrator for dry runs), skip this step and the next, but still produce the report. Otherwise continue.

7. **Open the pull request** with the gh CLI. Use the title and description you composed above. Pass the description via a heredoc to preserve the release-note block exactly:
\`\`\`
gh pr create \\
  --base ${"`git rev-parse --abbrev-ref origin/HEAD | sed 's@^origin/@@'`"} \\
  --head "$BRANCH_NAME" \\
  --title "<the PR title>" \\
  --body "$(cat <<'PRBODY'
<the PR description, verbatim, no HTML comments, including the release-note fenced block and \`Resolves ${t.id}\`>
PRBODY
)"
\`\`\`
Capture the PR URL printed by \`gh\` and append a "## PR URL" section to release_report.md, then \`git add\` + \`git commit --amend --no-edit\` (or a separate commit) so the URL is persisted.

## Finish steps
End your final message with:
\`RELEASE_COMPLETE: <PR URL or "skipped (SKIP_PUSH)">\``;
}
