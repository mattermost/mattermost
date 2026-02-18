# E2E-Agents Files & Directories Guide

## 📋 Key Files in `.e2e-ai-agents/`

### Files TO TRACK (Commit to Git) ✅

#### 1. **gap.json** - Test Gaps
**What it shows**: Which flows have NO tests (test coverage gaps)

```json
{
  "flows": [
    {
      "name": "messaging.send",
      "priority": "P0",
      "description": "Send message in channel"
    },
    {
      "name": "channels.switch",
      "priority": "P1",
      "description": "Switch between channels"
    }
  ]
}
```

**How it's used**:
- Phase 2 (Test Generation): Identifies which tests to generate
- PR comments: Shows "5 test gaps detected, 3 P0 priority"
- Metrics: Tracks test coverage improvements

**Example action**: "gap.json shows 6 P0 gaps → generate tests for those flows"

---

#### 2. **impact.json** - Impact Analysis
**What it shows**: Which flows are AFFECTED by code changes (which tests to run)

```json
{
  "flows": [
    {
      "name": "messaging.send",
      "files": ["webapp/channels/components/SendMessage.tsx"],
      "confidence": 0.95,
      "priority": "P0"
    },
    {
      "name": "messaging.realtime",
      "files": ["webapp/channels/hooks/useSocket.ts"],
      "confidence": 0.87,
      "priority": "P0"
    }
  ]
}
```

**How it's used**:
- Impact analysis: Decides targeted testing strategy
- PR comments: Shows "Changes affect 2 P0 flows, 1 P1 flow"
- Traceability: Maps changes to affected tests (with traceability.json)

**Example action**: "impact.json shows messaging.send affected → run messaging tests"

---

#### 3. **plan.json** - Test Plan
**What it shows**: The recommended test execution plan for this PR/change

```json
{
  "plan": {
    "runSet": "targeted",
    "tests": ["messaging.send", "messaging.realtime"],
    "reason": "Impact analysis identified 2 affected P0 flows"
  }
}
```

**How it's used**:
- CI/CD: Determines which tests to run
- Phase 2: Identifies what to generate
- Phase 5 (Feedback): Compares recommendations vs actual results

**Example action**: "plan.json recommends testing messaging → GitHub Actions runs those tests"

---

#### 4. **traceability.json** - Test-to-File Manifest
**What it shows**: Which tests cover which source files (Phase 1 output)

```json
{
  "tests": [
    {
      "file": "specs/functional/messaging/send_message.spec.ts",
      "covers": ["webapp/channels/components/SendMessage.tsx"],
      "confidence": 1.0
    }
  ]
}
```

**How it's used**:
- Impact analysis: Maps files → tests (coverage-based)
- Traceability: Shows test coverage per file
- Phase 1: Foundation for intelligent test selection

---

### Files TO IGNORE (Don't Commit) ❌

| File | Purpose | Why Ignore |
|------|---------|-----------|
| **traceability-input.json** | Temporary capture file | Auto-generated each run |
| **feedback-input.json** | Temporary feedback data | Per-run data, auto-generated |
| **feedback-metrics.json** | Calibration metrics | Per-run, local only |
| **metrics.jsonl** | Token/cost tracking | Local analytics only |
| **metrics-summary.json** | Weekly aggregation | Local only |
| **llm-health.json** | LLM provider status | Per-run, not persistent |
| **healing-summary.json** | Per-run healing data | Auto-generated |
| **generation-summary.json** | Per-run generation data | Auto-generated |
| **reports/** | HTML reports | Build artifacts |
| **ci-summary.md** | Workflow output | Transient |

---

## 📁 Directory Structure

```
e2e-tests/playwright/
├── .e2e-ai-agents/
│   │
│   ├── TRACKED (commit to git):
│   │   ├── gap.json              ← Test gaps (uncovered flows)
│   │   ├── impact.json           ← Impact of code changes
│   │   ├── plan.json             ← Test execution plan
│   │   └── traceability.json     ← Test-to-file mappings (Phase 1)
│   │
│   ├── IGNORED (temporary/auto-generated):
│   │   ├── *-input.json          ← Temporary capture files
│   │   ├── *-metrics.json        ← Per-run metrics
│   │   ├── *-summary.json        ← Per-run summaries
│   │   ├── metrics/              ← Token usage tracking
│   │   └── reports/              ← HTML/markdown reports
│   │
│   └── .gitignore               ← Specifies what to track
│
├── .claude/                      ← IGNORED (IDE cache)
│   ├── agents/
│   └── prompts/
│
├── specs/
│   └── functional/
│       └── ai-assisted/         ← Auto-generated tests (Phase 2)
│
└── ...
```

---

## 🤔 gap.json vs impact.json - Which Do I Use?

### When checking gap.json ("What needs tests?")
```bash
# See what tests are missing
npm run test:ai:gap

# Example question: "Which flows have zero test coverage?"
# Answer: gap.json tells you
```

**Used in**: Phase 2 (Test Generation) to decide WHAT to generate

---

### When checking impact.json ("What's affected?")
```bash
# See what changed code affects
npm run test:ai:impact

# Example question: "Which flows are affected by my changes?"
# Answer: impact.json tells you
```

**Used in**: Phase 2 (Test Generation) to decide WHAT TESTS TO RUN

---

### Real Example

**Scenario**: You changed messaging send logic

```
gap.json says:
  - messaging.send needs tests (P0)
  - messaging.edit needs tests (P1)

impact.json says:
  - Your changes affect: messaging.send, messaging.realtime
  - NOT affected: messaging.edit

Action:
  Phase 2 reads impact.json
  → "Your changes affect these flows"
  → Plan: "Run messaging tests"
  → Phase 1+2: "Generate missing tests for messaging flows"
```

---

## .claude/ Directory

**What it is**: Claude IDE cache/context directory

**Contains**:
- agents/ - Cached agent definitions
- prompts/ - Cached prompt templates

**Why ignore it**:
- ✅ Not needed (using standalone e2e-agents repo)
- ✅ Local cache only
- ✅ Regenerated on demand
- ✅ Similar to .vscode/, .idea/, node_modules/

**Status**: Already in .gitignore (added in this commit)

---

## Why Use Standalone e2e-agents Repo?

### Before: Local Agents (❌ Less ideal)
- Coupled to Mattermost monorepo
- Hard to update independently
- Difficult to share/version
- Scattered across multiple files

### After: Standalone e2e-agents (✅ Better)
- **Independent updates**: Version controlled separately
- **Reusable**: Can be used in other Mattermost projects
- **Tailored**: Customized specifically for Mattermost patterns
- **Maintainable**: Clean separation of concerns
- **Production ready**: Published as npm package (@yasserkhanorg/e2e-agents)

**Current setup**:
```json
{
  "dependencies": {
    "@yasserkhanorg/e2e-agents": "^0.3.4"
  }
}
```

This gives us:
- Centralized, maintained agents
- No local cache needed
- Clean monorepo
- Easy to upgrade

---

## ✅ Gitignore Summary

### Tracked (✅ commit these)
```
gap.json              - What tests are missing
impact.json           - What's affected by changes
plan.json             - Test execution plan
traceability.json     - Test-to-file mappings
```

### Ignored (❌ don't commit)
```
.claude/                          - IDE cache
.e2e-ai-agents/*-input.json      - Temporary files
.e2e-ai-agents/*-metrics.json    - Per-run data
.e2e-ai-agents/*-summary.json    - Per-run summaries
.e2e-ai-agents/metrics/          - Token tracking
.e2e-ai-agents/reports/          - Build artifacts
```

---

## 📊 When Each File Is Created

| File | Created | Updated | Who Creates |
|------|---------|---------|------------|
| **gap.json** | First `npm run test:ai:gap` | Every gap analysis | e2e-ai-agents CLI |
| **impact.json** | First git change detected | Every PR/push | e2e-ai-agents CLI |
| **plan.json** | During Phase 2 generation | Each generation | e2e-ai-agents CLI |
| **traceability.json** | Phase 1 workflow | After test execution | GitHub Actions |
| **Temp files** | Per-run | Per-run | Various workflows |

---

## 🎯 Key Takeaway

**Gap.json** = "What's missing" (inventory of gaps)
**Impact.json** = "What's affected" (which tests to run)
**Together** = Smart test selection based on data

Both should be tracked so PR comments can show accurate information!

---

**Last Updated**: February 18, 2026
**Part of**: E2E-Agents Full Capability Implementation
**Related**: E2E_AGENTS_IMPLEMENTATION_COMPLETE.md
