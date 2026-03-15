---
agent: playwright-test-healer
description: Fix failing tests
---

Parameters:
- testFiles (optional): comma-separated list of spec file paths to heal. If omitted, heals all tests.

Run and fix only the following test files: {{testFiles}}.

For each failing test, diagnose the root cause and apply fixes. Do not modify tests outside the specified files.
