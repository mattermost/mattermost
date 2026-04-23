# Phase 1: Requirements

**Goal**: Transform vague input into structured requirements with acceptance criteria.

## Requirements Mode Detection

Phase 1 operates in one of three modes based on the input:

| Mode | Trigger | Flow |
|------|---------|------|
| **Standard** | Input has a ticket ID, spec link, or detailed description (3+ sentences) | Steps 1.1 → 1.2 → 1.3 → 1.3.5 → 1.4 (normal flow) |
| **Triage** | Input describes a bug/issue with minimal context (1-2 sentences, maybe a screenshot, no ticket) OR `--triage` flag | Steps 1.0.1 → 1.0.2 → 1.0.3 → merge into standard flow at 1.2 |
| **Ideation** | Input is a "what if" / "we should" / "it would be nice" idea with no existing spec OR `--ideate` flag | Steps 1.0A.1 → 1.0A.2 → 1.0A.3 → merge into standard flow at 1.2 |

**Auto-detection heuristics**:
- **Triage**: input has fewer than 3 sentences, no ticket ID, no URLs, no file paths, AND uses problem language (broken, bug, error, not working, regression, crash)
- **Ideation**: input uses aspirational language (should, could, what if, idea, wouldn't it be nice, feature request) AND no ticket ID, no spec link
- **Standard**: everything else (ticket ID present, spec linked, detailed description)
- The `--triage` and `--ideate` flags force a mode regardless of heuristics

---

## Triage Mode (Step 1.0)

Live-reported issues with minimal context. Investigate first, document second.

### Step 1.0.1: Capture & Clarify

Record what you have:
- **Report**: the original text (even if just "pagination is broken on channels page")
- **Screenshot**: if provided, read it and extract visible error messages, URL, UI state, browser console errors
- **Reporter context**: who reported it, what environment (production, staging, community server), when it started

If the report is ambiguous, ask the user ONE round of clarifying questions (max 3 questions). Focus on:
- What is the expected vs actual behavior?
- Can they reproduce it? Steps?
- Which environment/version?

Do NOT ask for a full spec — the point of triage mode is to work with what you have.

### Step 1.0.2: Investigate & Auto-Reproduce

Spawn an **Explore** agent to investigate the codebase, then attempt a fully automated reproduction:

**Investigation**:
1. **Locate the affected area**: Use the report text + screenshot to identify the relevant code paths
   - Search for component names, route paths, API endpoints mentioned or visible in the report
   - Read the identified files to understand current behavior
2. **Check recent changes**: `git log --oneline -20 -- <affected files>` — look for recent commits that could have introduced the issue
3. **Trace the flow**: Follow the code path from UI → API → store/DB for the reported behavior
4. **Form a hypothesis**: Based on what you find, describe:
   - **Root cause hypothesis** (what's likely broken and why)
   - **Affected scope** (which users/features/environments are impacted)
   - **Severity assessment**: Critical (data loss, security, service down) / High (feature broken, no workaround) / Medium (feature broken, workaround exists) / Low (cosmetic, edge case)
   - **Confidence**: High / Medium / Low (how certain you are of the root cause)

**Automated reproduction** (attempt all that apply):
5. **Write a failing test**: Based on the hypothesis, write the simplest possible test that demonstrates the broken behavior. Run it to confirm it fails.
   - Go: `_test.go` file targeting the affected function with the triggering input
   - React: `.test.tsx` file rendering the component in the broken state
   - API: test calling the endpoint with the triggering payload
6. **Playwright repro** (if UI bug and MCP available): Use `browser_navigate` → reproduce the user's steps → `browser_snapshot` → `browser_take_screenshot` to capture the broken state automatically
7. **API repro**: If the bug is in an API endpoint, construct and execute the failing request via Bash (curl or equivalent) and capture the response

Record which methods were attempted and their results. A confirmed automated repro dramatically increases confidence in the hypothesis and gives Phase 4 a pre-written regression test.

### Step 1.0.2.5: Reproduce & Verify (bugs/issues only)

Before documenting findings, attempt to reproduce the issue to confirm the hypothesis:

1. **Write a minimal reproduction plan**: describe the exact steps to trigger the bug (API call, UI interaction, data setup). Keep it as small as possible — isolate the trigger from unrelated setup.
2. **Attempt reproduction**:
   - **Unit test**: if the bug is in a function/method, write a failing test that demonstrates the broken behavior. This becomes the regression test in Phase 4.
   - **Playwright MCP**: if the bug is UI-visible and Playwright is available, navigate to the affected page and reproduce the steps interactively (`browser_navigate`, `browser_click`, `browser_snapshot`). Capture a screenshot of the broken state.
   - **API call**: if the bug is in an API endpoint, construct the failing request (curl or equivalent) with the triggering input.
   - **Manual steps**: if no automated reproduction is possible, write numbered steps the user can follow.
3. **Record the result**:
   - If reproduced: note "Confirmed — reproduced via <method>" and include the test, screenshot, or curl command in `<artifact_dir>/spec.md`
   - If not reproduced: note "Could not reproduce — hypothesis may be wrong" and ask user for more context before proceeding
4. **Security issues**: see [rules.md §3.3](rules.md#33-test-code) — benign equivalent inputs only, ticket ID references only.

Save reproduction artifacts (failing test file, screenshot, curl command) to `<artifact_dir>/repro/`. These feed directly into Phase 4's regression test.

### Step 1.0.3: Document & Ticket

Present the triage findings to the user:

```text
Triage Report:
  Reported: "<original report>"
  Severity: <Critical/High/Medium/Low>
  Affected: <component/feature/area>
  Hypothesis: <root cause hypothesis>
  Confidence: <High/Medium/Low>
  Evidence: <file:line references, git log, reproduction steps>
  Suggested fix scope: <XS/S/M/L>

Next steps:
  [1] Create Jira ticket with these findings
  [2] Proceed to fix (skip ticket creation)
  [3] Investigate further (need more context)
```

If the user chooses [1] (create ticket):
- Draft a Jira ticket via `acli jira workitem create` (if available) with:
  - Title: concise description of the issue
  - Description: Problem / Investigation / Hypothesis / Steps to Reproduce / Severity
  - Type: Bug (or Security Bug if security signals detected)
  - Labels: from-triage
- Update state.json with the new ticket ID
- Add the ticket details to `<artifact_dir>/spec.md`

If the user chooses [2] (proceed directly):
- Write the triage findings directly into `<artifact_dir>/spec.md` as the requirements basis
- Skip ticket creation — the fix PR itself will be the documentation

If the user chooses [3] (investigate further):
- Ask specific follow-up questions based on what the investigation revealed
- Re-run Step 1.0.2 with the new context

After triage: merge into standard flow at Step 1.2 — findings substitute for ticket reference material.

---

## Ideation Mode (Step 1.0A)

"What if" brainstorms and MVF (Minimum Viable Feature) exploration. Go from loose idea to buildable spec.

### Step 1.0A.1: Capture the Idea

Record the raw idea. Explore with a lightweight brainstorm:

- **What problem does this solve?** Who feels this pain? How do they work around it today?
- **What does success look like?** Describe the ideal end state in 1-2 sentences.
- **Who is the user?** Admin, end user, system admin, integration developer?

Keep this conversational — 2-3 exchanges max. The point is to sharpen the idea, not write a PRFAQ.

### Step 1.0A.2: Feasibility & MVF Scoping

Spawn an **Explore** agent to assess feasibility against the current codebase:

1. **Find the seams**: Where would this capability live? What existing infrastructure (APIs, components, stores, models) can it build on?
2. **Identify the MVF** — Minimum Viable Feature: What is the smallest useful slice that delivers the core value? Strip away nice-to-haves. A good MVF:
   - Solves the core problem for ONE user persona
   - Ships behind a feature flag
   - Can be built in ≤1 week of dev time
   - Doesn't require schema migrations (or requires only additive ones)
3. **Identify what it does NOT include** — explicitly list the v2/v3 capabilities that are out of scope for MVF
4. **Estimate effort**: XS/S/M/L based on layers touched

Present the feasibility findings:
```text
Idea: "<original idea>"
MVF: <one-sentence description of the minimum viable slice>
Builds on: <existing components/APIs/patterns>
Layers: <which layers touched>
Effort: <XS/S/M/L>
Not in MVF: <list of deferred capabilities>
```

### Step 1.0A.3: Document & Create Ticket

Ask the user:
```text
MVF looks buildable. Next steps:
  [1] Create Jira ticket + lightweight spec → continue to Phase 2
  [2] Draft a full PRFAQ / Epic (for larger ideas that need stakeholder buy-in first)
  [3] Just write the spec → proceed without ticket
  [4] Park it — save findings to `<artifact_dir>/spec.md` and stop (resume later with --skip-to requirements)
```

If [1] (create ticket + spec):
- Create a Jira Story via `acli` with: Title, Problem/Justification/Solution from brainstorm, MVF scope, acceptance criteria derived from the MVF description
- Write `<artifact_dir>/spec.md` with the MVF-scoped requirements
- Update state.json with ticket ID

If [2] (full PRFAQ/Epic):
- Draft a PRFAQ skeleton: Customer Problem, Solution, FAQ (skeptic Q&A), Success Metrics
- Draft an Epic description using the Problem/Justification/Solution template
- Present to user for review — this exits the pipeline (PRFAQ needs stakeholder review before building)
- Save artifacts to `<artifact_dir>/` for later resumption

If [3] (spec only):
- Write spec.md with MVF-scoped requirements, proceed directly

If [4] (park it):
- Save findings to spec.md, update state.json status to `parked`, stop

After ideation (options 1 or 3): merge into standard flow at Step 1.2.

---

## Standard Mode

### Step 1.1: Extract & Fetch References

Scan the input text for links and identifiers. Fetch each into context before analysis:

| Pattern | Tool | Example |
|---------|------|---------|
| Jira ticket (`MM-12345`, Atlassian URL) | `acli jira workitem view MM-12345` | Ticket description, acceptance criteria, comments, triage notes |
| Figma URL | `figma:figma-implement-design` skill or `mcp__figma-dev-mode-mcp-server__*` MCP | Design specs, component structure, visual requirements |
| Confluence/wiki URL | `acli confluence` or `mcp__mcp-atlassian__` | Spec documents, architecture decisions |
| GitHub issue/PR URL | `gh issue view` / `gh pr view` | Issue description, discussion, linked PRs |
| Generic URL | `WebFetch` | Any linked doc, spec, or reference |
| Inline file paths | `Read` tool | Local files referenced in the input |

**Inference**: Also scan for implicit references:
- Ticket IDs without URLs (e.g., "see MM-56762") → fetch via `acli`
- Feature names that match existing `docs/*.md` → read for context
- Component names that match Figma pages → fetch design if Figma MCP available

Collect all fetched content into a `## Reference Material` section in the tracking file.

### Step 1.1.5: Security Classification

After fetching the Jira ticket, inspect it for security signals:

**Detection triggers** (any one is sufficient):
- Ticket type is `Security Bug`, `Vulnerability`, or similar
- Ticket labels include `security`, `cve`, `hackerone`, or `vulnerability`
- Ticket description or fields contain a CVE ID (`CVE-YYYY-NNNNN`), CVSS score, or HackerOne URL
- Ticket is in a restricted/private Jira project

If a security issue is detected:

1. **Update state.json** `security` object:
   - `is_security_issue: true`
   - `ticket_type`: the Jira issue type field value
   - `severity`: CVSS score or label (Critical/High/Medium/Low) if present in ticket
   - `cve`: CVE ID if already assigned (e.g., `"CVE-2025-12345"`)
   - `embargo_until`: embargo/disclosure date if specified in ticket

2. **Alert the user** — display prominently:
   ```text
   ⚠ SECURITY ISSUE DETECTED (type: <ticket_type>)
   This is a sensitive PR. Special handling required per:
   https://handbook.mattermost.com/operations/security/product-security/working-on-sensitive-prs

   All downstream phases will apply the Security Handling rules:
   see rules.md §3 (language, branch naming, test code, PR sanitization,
   commit log audit, leak response, MUST_FIX discipline, backport timing).
   ```

3. **Branch naming**: If the branch was already created with a descriptive name, warn per [rules.md §3.2](rules.md#32-branch-naming) and offer to rename before first push.

4. **Add to spec.md**: Include a `## Security Classification` section noting the sensitivity level, CVE (if known), and embargo date.

If no security signals are found: continue normally.

### Step 1.2: Analyze Requirements

Spawn a `general-purpose` agent (prefer a **fast/lightweight model** for speed) with the input text AND all fetched reference material:

```text
You are a requirements analyst. Given this feature request and its reference material:

FEATURE REQUEST:
"{original input text}"

REFERENCE MATERIAL:
{fetched Jira ticket details, Figma specs, Confluence docs, etc.}

PROJECT PROFILE: {profile name}

Produce:
1. SUMMARY: 1-2 sentence description
2. ACCEPTANCE CRITERIA: Numbered list of concrete pass/fail conditions (merge from input + Jira + specs)
3. DESIGN REQUIREMENTS: Visual/UX requirements extracted from Figma or specs (if any)
4. AFFECTED LAYERS: Which layers this touches (for MM: model/store/app/api/webapp)
5. SCOPE: XS (typo/config tweak) / S (1 file) / M (1 layer) / L (multi-layer) / XL (cross-system)
6. AMBIGUITIES: Questions or assumptions that need user confirmation
7. NON-GOALS: What this explicitly does NOT include
8. LINKED ARTIFACTS: List of all references fetched and their key takeaways
```

### Step 1.2.5: Reproduction

For broken/unexpected behavior: write a reproduction plan before gap analysis. Skip for feature requests unless verifying baseline behavior.

1. **Extract repro steps**: Pull steps to reproduce from the ticket description, comments, or triage notes. If none exist, derive them from the requirements analysis.
2. **Write a failing test** (preferred): Create a minimal test that demonstrates the broken behavior. This becomes the RED in TDD — Phase 3 implements the fix to make it pass.
   - Place in `<artifact_dir>/repro/` and reference in spec.md
   - For security issues: use benign equivalent inputs, not exploit payloads
3. **Alternative repro methods** (if a test isn't feasible):
   - Playwright MCP: navigate and reproduce the UI bug, capture screenshot of broken state
   - API call: construct the failing request with triggering input
   - Manual steps: numbered list the user can follow
4. **Verify reproduction**: Run the failing test or execute the repro steps. If the bug doesn't reproduce, note it in spec.md and ask the user for clarification before continuing.

The reproduction artifact feeds into Phase 4 as a pre-written regression test. If a failing test was written here, Phase 3 starts with it already RED.

### Step 1.3: Gap Analysis & Alternative Perspectives

Before proceeding, challenge the requirements from multiple angles:

- **User perspective**: Who are the different user personas affected? Are there admin vs end-user considerations? What about new users vs power users?
- **Edge cases**: What happens at scale? With empty data? With concurrent access? During network failures?
- **Existing behavior**: Does this change or break any current workflow? Are there migration concerns for existing users/data?
- **Adjacent features**: What related features might be affected? Are there interactions with notifications, search, permissions, or real-time updates that aren't mentioned?
- **Negative requirements**: What should explicitly NOT happen? (e.g., "this must not trigger a notification", "this must not require a server restart")
- **Accessibility**: Are there a11y implications not captured in the acceptance criteria?
- **Performance**: Are there latency/throughput expectations? Large dataset concerns?
- **Security/OWASP**: If the feature handles user input, authentication, or data access: lightweight threat check — XSS (React context escaping), CSRF (API endpoint protection), privilege escalation (permission boundaries), data exposure (logging PII)

Add any discovered gaps to the AMBIGUITIES or ACCEPTANCE CRITERIA lists.

**Gate logic**:
- If AMBIGUITIES are found AND scope is M+: **ask user** to confirm/clarify via AskUserQuestion
- If scope is XS/S with no ambiguities: auto-proceed
- Save requirements (spec.md) + reference material to artifact directory

### Step 1.3.5: Epic & PRD Document Check

Runs in **advisory mode** when a Jira ticket is present — findings are noted in spec.md but do not block the pipeline by default. Blocking behavior requires `--refs strict` or a critical gap for M+ scope (see step 5). Skip entirely for XS scope.

**1. Detect Epic context**:
- If the fetched ticket is type `Epic`: audit it directly
- If the ticket has a parent Epic field: fetch the Epic via `acli jira workitem view <epic-key>`
- If neither: apply the lightweight Story check (sub-step 2b only) and skip the rest

**2a. Epic Description audit** — the description must contain all three sections with substantive content (not just placeholder text):

```text
Problem:      [what problem are we solving]
Justification:[why important, how it aligns with parent company objective]
Solution:     [how we're solving it, why this approach, alternatives considered]
```

Flag any section that is missing, still contains placeholder brackets, or is less than 2 meaningful sentences.

**2b. Story/ticket description audit** (applies even without an Epic):
- Check if the ticket description contains Problem / Justification / Solution (or equivalent context)
- For Stories: these sections may be less formal, but the *why* must be derivable from the ticket
- If missing: offer to draft them from the requirements already captured in spec.md

**3. Epic Fields checklist** — for Epics, verify each field via the fetched ticket data:

| Field | Required before | Check |
|-------|----------------|-------|
| Team + Assignee | Any work starts | Set to project owner |
| Parent | Any work starts | Linked to Company Objective |
| Start Date + End Date | Any work starts | Dev completion dates (not release date) |
| Fix Version | Scheduling | Set if feature targets a specific release |
| Status / Health | Ongoing | On Track / At Risk / Blocked; comment required if At Risk or Blocked |
| GreenLight PRD | Feature Spec Design | Link present |
| ProductBoard link | Feature Spec Design | Link present |
| Feature Spec | Technical Spec Design | Link present |
| Technical Spec | Code Development | Link present |
| Security Approver | Beta or GA | Security reviewer named |

**4. Linked document audit** — for each linked document field that is populated, assess content depth:
- Fetch Confluence pages via `acli confluence` or `WebFetch` if accessible
- Check for stub pages (just a title, no body), placeholder sections, or broken links
- Assess: GreenLight PRD, ProductBoard link, Feature Spec, Technical Spec, any test plans, design links (Figma)

**5. Present findings and offer drafts**:

Produce a status table and note findings in spec.md. Then determine whether to surface the draft menu:

- **Auto-skip the draft menu** (default) when: scope is XS/S, OR `--refs strict` is NOT set and no critical gaps exist. Silently note the findings in `## Epic & PRD Status` in spec.md and proceed.
- **Surface the draft menu** when: `--refs strict` is set, OR a **critical gap** exists for M+ scope: GreenLight PRD is missing (required before Feature Spec Design milestone) or Technical Spec is missing (required before Code Development milestone).

```text
Epic <KEY> document status:
  Description
    ✓ Problem: present
    ✗ Justification: missing
    ~ Solution: sparse (1 sentence)
  Fields
    ✓ Team/Assignee
    ✗ Parent (Company Objective not linked)
    ~ Fix Version: not set
    ✗ GreenLight PRD: no link        ← CRITICAL (M+ scope)
    ✗ Feature Spec: no link
    ✓ Technical Spec: <link> (content looks substantive)
    ✗ Security Approver: not set

⚠ Critical gap: GreenLight PRD missing (required before Feature Spec Design)
I can draft the following based on spec.md requirements:
  [1] Epic Description (Problem / Justification / Solution)
  [2] PRD — using the Mattermost PRD template structure
  [3] Feature Spec skeleton
  [4] Ticket Problem/Justification for <TICKET-KEY>

Reply with numbers to draft, or "skip" to continue.
```

When advisory-only (no critical gaps or XS/S scope), do not show the numbered menu. Just note findings and proceed.

**6. Drafting**:

- **Epic Description**: draft Problem / Justification / Solution sections
- **PRD** (template: https://docs.google.com/document/d/1JI7JRVDigEa1NmWWla18bmjlpxCLDUvsxskF7FJhyRE/edit): draft using the Mattermost PRD template structure:
  - *Feature Name* + header fields (PM, Eng Lead, UX Designer, Target Release — fill from ticket where known)
  - *Outcome Objective* — 1-sentence expected outcome summary
  - *Customer Pains and Use Cases* — table (Customer Name & Source Person, Pain/Use Case with link, Solution Urgency, Solution Validation, Account ARR) — populate from ticket's customer/use-case context where available, flag empty cells
  - *Solution Design Scope* — numbered capability list derived from acceptance criteria
  - *Implementation Estimates* — Dev / QA / UX effort placeholders (fill from scope classification if known)
  - *Learning Plan* — Design Validation entry noting which customers/cohorts are targeted
- **Technical Spec** (template: https://docs.google.com/document/d/1_rpn4XDHFozwnbdoXSMLu1d1NT9pmCqqtcNC_1g1n3c/edit): draft using the Mattermost Technical Specification template structure:
  - *Header*: Author, date, Specification Title
  - *Overview*: 2-3 paragraph background — why written, problem, solution approach (present tense)
  - *Goals*: numbered list of discrete objectives
  - *Scope*: what is covered and explicitly out of scope
  - *Background Reading*: links to relevant materials
  - *Terminology*: key terms defined
  - *Specifications* body — populate relevant subsections based on what the feature touches:
    - *High-level Architecture*: system overview + diagram placeholders
    - *Schema*: new tables, column changes, migration notes (cross-reference Phase 5.6 migration rules)
    - *REST API*: new/changed endpoints
    - *CLI*: any CLI changes
    - *Configuration*: new config settings
    - *Frontend*: UI/component changes
    - *Performance*: performance considerations
    - *Plugins*: plugin interaction concerns
  - *Credits*, *History*, *Wording* (RFC 2119 boilerplate)
  - Mark sections as `N/A` where not applicable rather than omitting them
- **Feature Spec skeleton**: title, overview, acceptance criteria (from spec.md), open questions
- **Story description**: Problem / Justification / Solution for the current ticket

**Write behavior**:
- **Default** (no `create`/`update` token): draft only. Do NOT push content to Confluence or update Jira fields. After drafting, suggest specific `acli jira workitem edit` or Confluence actions the user should take.
- **With `--refs create`**: for missing refs (Jira ticket, Confluence page, PRD, Feature Spec, Technical Spec), present a creation plan — what will be created, where, with what title — and prompt for confirmation. On approval, create via `acli`/Confluence API and record the new IDs/URLs in spec.md's `## Epic & PRD Status`.
- **With `--refs update`**: for existing but incomplete/stale refs (e.g., Epic description missing Justification, PRD with placeholder sections), present an update plan — which fields/sections will change, with diff — and prompt for confirmation. On approval, patch via `acli jira workitem edit` / Confluence update API.
- Either write-token can be combined with `strict`. On decline at the prompt, fall back to draft-only.

**7. Note in spec.md**: Add an `## Epic & PRD Status` section summarizing field completeness and linking to any drafts produced.

### Step 1.4: Phase Depth Scaling

**All phases run by default.** Scope determines the *depth* of each phase, not whether it executes. Every phase must be thoroughly evaluated for relevancy, even if the evaluation is brief for small scopes. Only explicit flags (`--skip review`, `--skip pr`) or missing prerequisites (no Jira ticket for Phase 8) can suppress a phase.

| Size | Description | Phase Depth |
|------|-------------|-------------|
| **XS** | Typo, config change, one-liner | All phases run with minimal depth. Requirements: 1-2 sentence spec. Plan: brief inline plan. Test: verify no regressions. Quality: full lint pass. Review: quick sanity check. Ship: standard commit flow. Release: update ticket if exists. |
| **S** | Single file, clear fix | All phases run with light depth. Requirements: concise spec. Plan: short plan, skip domain consultation. Test: unit tests + E2E relevancy check. Quality: full checks. Review: focused review on changed area. Ship/Release: standard. |
| **M** | Single layer, moderate scope | All phases run with moderate depth. Requirements: full spec. Plan: abbreviated plan with domain consultation if needed. Test: unit + E2E where applicable. Quality: full checks. Review: tier-scaled review. Ship/Release: standard. |
| **L** | Multi-layer feature | All phases run at full depth. Complete pipeline with domain consultation, comprehensive testing, full-tier review. |
| **XL** | Cross-system, multi-repo | All phases run at full depth + cross-repo coordination flags. |

Present to user as:
```text
Scope: M (single layer — webapp Redux state changes)
Phases: Setup → Requirements → Plan → Implement → Test → Quality → Review → Ship → Release
Depth: Moderate — all phases evaluated, plan abbreviated, review tier-scaled
```

The user can adjust depth with flags (`--minimal` for lighter treatment within phases). Only `--skip <phase>` (e.g. `--skip review`, `--skip pr`) can suppress specific phases or sub-steps.

---
