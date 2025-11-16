# AI-Assisted E2E Tests

This directory contains E2E tests that were generated from Zephyr test cases using the automated conversion workflow.

## Purpose

These tests bridge the gap between manual test cases in Zephyr Scale and automated E2E tests in Playwright, ensuring features don't ship without proper test coverage.

## Generation Process

Tests in this folder are created using the Zephyr integration workflow:

```bash
# 1. Pull test case from Zephyr
npm run zephyr:pull

# 2. Convert test case to E2E test
npm run zephyr:convert MM-TXXX

# 3. Review and enhance the generated test

# 4. Run the test
npm run test -- <test-file-name>

# 5. Mark as automated in Zephyr
npm run zephyr:push MM-TXXX
```

## Test Structure

Generated tests follow Mattermost E2E conventions:
- Proper JSDoc documentation with `@objective` and `@precondition`
- Team-based tags (e.g., `@calls`, `@channels`, `@playbooks`)
- Semantic locators and page objects
- Action comments (`// #`) and verification comments (`// *`)
- Test key in title (e.g., `MM-T5382`)

## Workflow Benefits

- **Cost**: $0 (no AI tokens for conversion)
- **Speed**: Fast template-based generation
- **Traceability**: MM-T keys link tests to Zephyr
- **Bidirectional Sync**: Changes tracked in both systems

## Enhancement

While tests are initially generated from templates, they should be reviewed and enhanced by developers:
- Add edge cases
- Improve assertions
- Optimize selectors
- Add better error handling

## Maintenance

Tests in this folder are:
- Generated from Zephyr test cases
- Linked to Zephyr via MM-T keys
- Tracked with `Playwright` custom field in Zephyr
- Part of the regular E2E test suite

For more information, see the Zephyr integration documentation in the project root.
