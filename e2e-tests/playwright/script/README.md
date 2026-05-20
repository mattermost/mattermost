# Playwright E2E Test Scripts

This directory contains utility scripts for the Playwright E2E test suite.

## Test Documentation Format Linter

The `lint-test-docs.js` script verifies that all spec files follow the required documentation format:

- JSDoc with `@objective` and `@precondition` tags
- Proper test title with MM-T ID (e.g., MM-T1234)
- Tag for feature categorization (e.g., `{tag: '@feature_name'}`)
- Action comments (e.g., `// # Action`)
- Verification comments (e.g., `// * Verification`)

### Usage

```bash
# Run the linter directly
node script/lint-test-docs.js

# Or use the npm script
npm run lint:test-docs
```

### Integration with CI

The linter is also integrated with the main `check` command, which is typically run before committing changes:

```bash
npm run check
```

This will run ESLint, Prettier, TypeScript type checking, and the test documentation format linter.

### Requirements

All spec files should follow this format:

```typescript
/**
 * @objective Clear description of what the test verifies
 *
 * @precondition
 * Special setup or conditions required for the test
 * Note: Only include for non-default requirements
 */
test('descriptive test title', {tag: '@feature_tag'}, async ({pw}) => {
    // # Initialize setup and login
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Navigate to channel and post a message
    await channelsPage.goto();
    await channelsPage.postMessage('Test message');

    // * Verify message appears in the channel
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.body).toContainText('Test message');
});
```

This ensures consistency across all test files and makes it easier to understand the purpose and requirements of each test.
