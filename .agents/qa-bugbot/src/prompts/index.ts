export interface QaContext {
    prUrl: string;
    sessionSlug: string;
    featureDescription?: string;
    startingRef: string;
}

const REPO_RULES = `## Repository conventions
- Follow .cursor/rules/mattermost-core.mdc and AGENTS.md.
- Do NOT run \`go mod tidy\`; use \`make modules-tidy\` from \`server/\` if needed.
- After editing \`server/i18n/en.json\`, run \`make i18n-extract\` from \`server/\`.
- No secrets, .env, or credentials in commits.
- You are already on the PR branch in a cloud VM (via \`prUrl\`). Do not run \`gh pr checkout\`.`;

function featureBlock(ctx: QaContext): string {
    if (!ctx.featureDescription) {
        return `Target PR: ${ctx.prUrl}\nRead the PR title, description, and \`gh pr diff\` for feature context.`;
    }
    return `Target PR: ${ctx.prUrl}\n\nAdditional context from the operator:\n${ctx.featureDescription}`;
}

/** Agent 1 — QA Planner (read-only): happy path, edge cases, state transitions. */
export function qaPlannerPrompt(ctx: QaContext): string {
    return `You are **Agent 1: QA Planner** in a QA Bugbot chain on a **cloud** VM checked out to a pull request.

${featureBlock(ctx)}

${REPO_RULES}

## Your mission (read-only — no production code edits)
1. Read the PR description and diff (\`gh pr view\`, \`gh pr diff\`).
2. Infer the **feature under test** and document a structured QA plan.

## Deliverable
Create \`docs/qa-bugbot/${ctx.sessionSlug}/qa_plan.md\` with:

\`\`\`
# QA Plan: <feature title>

## Feature summary
## Happy path (scenario IDs HP-1, HP-2, ...)
## Edge cases (EC-1, ...)
## State transitions (ST-1, ...) — valid states, triggers, expected next state
## Out of scope
## Scenario table
| ID | Type | Preconditions | Steps | Expected | Modality |
\`\`\`

Each scenario row must include **Modality**: one of \`unit\`, \`integration\`, \`static\`, \`manual\`.

Commit only the plan file:
\`\`\`
git add docs/qa-bugbot/${ctx.sessionSlug}/qa_plan.md
git commit -m "docs(qa-bugbot): QA plan for ${ctx.sessionSlug}"
git push
\`\`\`

End your final message with exactly:
\`PLANNER_COMPLETE: docs/qa-bugbot/${ctx.sessionSlug}/qa_plan.md\``;
}

/** Agent 2 — QA Tester: execute scenarios, add/run tests, no prod fixes. */
export function qaTesterPrompt(ctx: QaContext, iteration: number): string {
    return `You are **Agent 2: QA Tester** (iteration ${iteration}) on the same PR branch.

${featureBlock(ctx)}

${REPO_RULES}

## Your mission
1. Read \`docs/qa-bugbot/${ctx.sessionSlug}/qa_plan.md\`.
2. If iteration > 1, read prior \`docs/qa-bugbot/${ctx.sessionSlug}/iteration-*/qa_results.md\`.
3. Execute **every** scenario in the plan:
   - **unit**: add or extend Jest/RTL tests for changed webapp components, or \`go test\` for server packages.
   - **integration**: run targeted package tests with realistic deps/mocks.
   - **static**: \`npm run check\` / lint / typecheck on affected areas.
   - **manual**: document steps taken and observed result in the results file.
4. Do **not** modify production code to fix failures — only tests and QA docs.
5. Record each scenario: **PASS** | **FAIL** | **SKIP** with evidence (command, file, error excerpt).

## Deliverable
Write \`docs/qa-bugbot/${ctx.sessionSlug}/iteration-${iteration}/qa_results.md\` and commit any new test files.

Commit:
\`\`\`
git add docs/qa-bugbot/${ctx.sessionSlug}/iteration-${iteration}/
git add -u
git commit -m "test(qa-bugbot): iteration ${iteration} QA results"
git push
\`\`\`

End your final message with exactly (use real counts):
\`TESTER_COMPLETE: pass=<n> fail=<n>\``;
}

/** Agent 3 — QA Fixer: fix production code for FAIL scenarios on the PR branch. */
export function qaFixerPrompt(ctx: QaContext, iteration: number): string {
    return `You are **Agent 3: QA Fixer** (after tester iteration ${iteration}) on the PR branch.

${featureBlock(ctx)}

${REPO_RULES}

## Your mission
1. Read \`docs/qa-bugbot/${ctx.sessionSlug}/iteration-${iteration}/qa_results.md\`.
2. Fix **only** scenarios marked **FAIL** — minimal diffs, reference scenario IDs in commits.
3. Re-run the tests/commands cited in the results file to verify fixes.
4. Do not rewrite the QA plan; update qa_results only if you need a short fixer note.

Commit production fixes:
\`\`\`
git add -A
git commit -m "fix(qa-bugbot): address FAIL scenarios from iteration ${iteration}"
git push
\`\`\`

End your final message with exactly:
\`FIXER_COMPLETE: addressed=<n>\``;
}

/** Agent 4 — PR Summary: verdict and optional PR comment. */
export function qaSummaryPrompt(opts: {
    ctx: QaContext;
    iterations: number;
    finalPass: number;
    finalFail: number;
    needsHuman: boolean;
    postPrComment: boolean;
}): string {
    const commentStep = opts.postPrComment
        ? `Post a single PR summary comment via \`gh pr comment\` (use \`--body-file\` with the summary). If GitHub returns 403, print the exact \`gh\` command for a human to run.`
        : `Do not post to GitHub; only write the summary markdown.`;

    const verdictHint = opts.needsHuman
        ? "**NEEDS HUMAN** — failures remain after max iterations or regression detected."
        : opts.finalFail === 0
          ? "**PASS** — all scenarios green."
          : "**FAIL** — unresolved scenario failures.";

    return `You are **Agent 4: QA Summary** for PR ${opts.ctx.prUrl}.

${featureBlock(opts.ctx)}

${REPO_RULES}

## Context
- QA iterations run: ${opts.iterations}
- Final tester counts: pass=${opts.finalPass} fail=${opts.finalFail}
- Suggested verdict: ${verdictHint}

## Your mission
1. Read all artifacts under \`docs/qa-bugbot/${opts.ctx.sessionSlug}/\`.
2. Write \`docs/qa-bugbot/${opts.ctx.sessionSlug}/summary.md\` with:
   - Verdict: PASS | FAIL | NEEDS HUMAN
   - Scenarios exercised (counts by type)
   - Failures fixed per iteration
   - Remaining risks / manual follow-ups
3. ${commentStep}

Commit:
\`\`\`
git add docs/qa-bugbot/${opts.ctx.sessionSlug}/summary.md
git commit -m "docs(qa-bugbot): QA summary for ${opts.ctx.sessionSlug}"
git push
\`\`\`

End your final message with exactly:
\`SUMMARY_COMPLETE: docs/qa-bugbot/${opts.ctx.sessionSlug}/summary.md\``;
}

export function qaContextFromEnv(
    env: import("../env.js").Env,
    sessionSlug: string,
): QaContext {
    return {
        prUrl: env.targetPrUrl,
        sessionSlug,
        featureDescription: env.featureDescription,
        startingRef: env.startingRef,
    };
}
