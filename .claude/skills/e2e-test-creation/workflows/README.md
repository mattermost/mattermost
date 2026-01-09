# Zephyr Test Automation Workflows

## Overview

This directory contains documentation for two workflows that bridge E2E test automation with Zephyr test management:

1. **Main Workflow (3-Stage Pipeline)** - Create new tests from scratch with Zephyr sync
2. **Automate Existing Workflow** - Automate existing Zephyr test cases

Both workflows integrate seamlessly with the existing `e2e-test-creation` skill without breaking changes.

## Workflows

### 1. Main Workflow: 3-Stage Pipeline

**File**: [`main-workflow.md`](./main-workflow.md)

**Purpose**: Create new E2E tests with automatic Zephyr test case creation and sync.

**Stages**:
```
Stage 1: Planning → Stage 2: Skeleton Files → Stage 3: Zephyr + Full Code
```

**Trigger**: User requests to create new tests
- "Create tests for login feature"
- "Generate E2E tests for channel creation"

**Process**:
1. **Stage 1**: Generate test plan (reuses existing planner)
2. **Stage 2**: Create skeleton `.spec.ts` files with "MM-TXXX" placeholders
3. **User Confirmation**: "Should I create Zephyr Test Cases?"
4. **Stage 3** (if confirmed):
   - Create test cases in Zephyr
   - Replace placeholders with actual keys (MM-T1234)
   - Generate full Playwright code
   - Execute tests
   - Update Zephyr with automation metadata

**Key Features**:
- ✅ Batch test case creation in Zephyr
- ✅ Automatic placeholder replacement
- ✅ Bi-directional sync
- ✅ Optional test execution
- ✅ Full automation metadata tracking

**Read More**: [Main Workflow Documentation](./main-workflow.md)

### 2. Automate Existing Test Workflow

**File**: [`automate-existing.md`](./automate-existing.md)

**Purpose**: Generate Playwright automation for existing Zephyr test cases.

**Trigger**: User provides Zephyr test key
- "Automate MM-T1234"
- "Generate automation for MM-T5678"

**Process**:
1. Fetch test case details from Zephyr
2. Validate/generate test steps (if missing)
3. Update Zephyr with generated steps
4. Generate full Playwright code
5. Write automation file locally
6. Execute test (optional)
7. Update Zephyr with automation metadata

**Key Features**:
- ✅ Works with incomplete test cases
- ✅ Automatically generates missing test steps
- ✅ Updates both local files and Zephyr
- ✅ Non-blocking execution
- ✅ Intelligent step generation

**Read More**: [Automate Existing Workflow Documentation](./automate-existing.md)

## Architecture

```
.claude/skills/e2e-test-creation/
├── agents/
│   ├── planner.md (existing - reused in Stage 1)
│   ├── generator.md (existing - reused in Stage 3C & Step 5)
│   ├── skeleton-generator.md (NEW - Stage 2)
│   ├── zephyr-sync.md (NEW - Stage 3)
│   └── test-automator.md (NEW - Automate Existing)
├── tools/
│   ├── zephyr-api.md (NEW - API integration)
│   └── placeholder-replacer.md (NEW - replace MM-TXXX)
├── workflows/
│   ├── README.md (this file)
│   ├── main-workflow.md (3-Stage Pipeline docs)
│   └── automate-existing.md (Automate Existing docs)
└── examples/zephyr-automation/
    ├── skeleton-example.md (Stage 2 examples)
    └── full-automation-example.md (Stage 3 examples)
```

## Quick Start

### Prerequisites

1. **Zephyr Configuration**

   Create `.claude/settings.local.json`:
   ```json
   {
     "zephyr": {
       "baseUrl": "https://mattermost.atlassian.net",
       "jiraToken": "YOUR_JIRA_PAT",
       "zephyrToken": "YOUR_ZEPHYR_TOKEN",
       "projectKey": "MM",
       "folderId": "28243013"
     }
   }
   ```

2. **Install Dependencies**
   ```bash
   cd e2e-tests/playwright
   npm install
   ```

### Usage Examples

#### Example 1: Create New Tests with Zephyr Sync

```
User: Create tests for the login feature