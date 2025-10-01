# Accessibility Testing Guidelines

Welcome to Mattermost's accessibility testing documentation. This guide covers how to write comprehensive accessibility tests that ensure our application meets WCAG 2.1 AA compliance standards and provides an inclusive experience for all users.

## Quick Start

1. **Location**: Place accessibility tests in `specs/accessibility/`
2. **Structure**: Organize by product → page → component
3. **Tags**: Include `@accessibility` and feature-specific tags
4. **Tools**: Use `axe` fixture for scanning, `toMatchAriaSnapshot` for semantic structure

## Documentation Structure

- **[This Page]**: Overview and folder organization
- **[Automated Scan Testing](automated_scan_testing.md)**: Using axe-core for automated accessibility scanning
- **[Interaction Testing](interaction_testing.md)**: Keyboard navigation, focus management, and screen reader testing

## Folder Structure

Accessibility tests follow a hierarchical organization by product area:

```
specs/accessibility/
├── common/                    # Shared components across products
│   ├── login.spec.ts
│   ├── reset_password.spec.ts
│   └── signup_user_complete.spec.ts
├── channels/                  # Channels product area
│   ├── settings_dialog/       # Settings dialog page/component
│   │   ├── notifications.spec.ts
│   │   ├── settings.spec.ts
│   │   └── notifications.spec.ts-snapshots-a11y/  # Aria snapshots
│   │       ├── desktop-and-mobile-section.yml
│   │       ├── email-notifications-section.yml
│   │       └── keywords-that-get-highlighted-section.yml
│   ├── account_menu_keyboard.spec.ts
│   ├── intro_channel.spec.ts
│   └── theme_settings.spec.ts
└── [future-products]/         # Boards, Playbooks, etc.
    └── [page-or-component]/
        └── test.spec.ts
```

### Naming Conventions

- **Products**: `channels/`, `boards/`, `playbooks/`
- **Pages**: `settings_dialog/`, `channel_header/`, `post_menu/`
- **Components**: `notifications.spec.ts`, `theme_picker.spec.ts`
- **Snapshots**: `[component-name]-section.yml`, `[feature-name]-modal.yml`

## Test Categories

Accessibility tests should cover these key areas:

### 1. Keyboard Navigation

- Tab order and focus management
- Enter/Space key activation
- Escape key handling
- Arrow key navigation for menus and lists

### 2. Screen Reader Support

- Proper ARIA labels and roles
- Meaningful announcements for state changes
- Alternative text for images and icons
- Semantic HTML structure

### 3. Focus Management

- Visible focus indicators
- Focus trapping in modals and dialogs
- Logical focus restoration
- Skip links and landmarks

### 4. Color and Contrast

- WCAG AA compliance (4.5:1 normal, 3:1 large text)
- High contrast mode compatibility
- Color not as sole information indicator

### 5. Zoom and Responsive

- 200% zoom without horizontal scrolling
- Mobile accessibility patterns
- Touch target sizes (44x44px minimum)

## Test Structure Template

```typescript
/**
 * @objective Clear description of what accessibility aspect is being verified
 *
 * @precondition Special setup conditions (omit if using standard setup)
 */
test('descriptive test title', {tag: ['@accessibility', '@feature_tag']}, async ({pw, axe}) => {
    // # Setup user and navigate to target
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // # Navigate to component under test
    await page.getByRole('button', {name: 'Settings'}).click();

    // # Perform accessibility interaction (keyboard navigation, etc.)
    await page.keyboard.press('Tab');
    const targetElement = page.getByRole('dialog', {name: 'Settings'});
    await pw.toBeFocusedWithFocusVisible(targetElement);

    // * Verify accessibility compliance with automated scan
    const results = await axe.builder(page).include('[role="dialog"]').analyze();
    expect(results.violations).toHaveLength(0);

    // * Verify semantic structure with aria snapshot
    await expect(targetElement).toMatchAriaSnapshot({
        name: 'component-state.yml',
    });
});
```

## Aria Snapshots

Aria snapshots capture the accessibility tree structure, ensuring proper semantic markup and screen reader experience.

### When to Use External vs Inline Snapshots

**Use External .yml Files** (Recommended):

- Static content that doesn't change between test runs
- Reusable components across multiple tests
- Complex structures that benefit from version control and diff tracking

```typescript
const notificationsPanel = page.getByRole('region', {name: 'Notifications'});
await expect(notificationsPanel).toMatchAriaSnapshot({
    name: 'notifications-panel.yml',
});
```

**Use Inline Snapshots**:

- Content with dynamic data (user IDs, timestamps, server configurations)
- Simple structures where external files add complexity
- One-off components unlikely to be reused

```typescript
await expect(element).toMatchAriaSnapshot(`
  - tabpanel "notifications":
    - heading "Notifications" [level=3]
    - link "Learn more":
      - /url: https://example.com/notifications?uid=${user.id}&sid=${clientConfig.DiagnosticId}
    - button "Edit Desktop notifications"
`);
```

### Snapshot Organization

- External snapshots: `[test-file].spec.ts-snapshots-a11y/`
- Descriptive names: `desktop-notifications-section.yml`, `keywords-modal-expanded.yml`
- Group by component or feature area

## Updating Snapshots

When UI structure changes, update aria snapshots:

```bash
# Update all accessibility snapshots
npm run test:a11y-update-snapshots

# Update specific test snapshots
npm run test -- specs/accessibility/channels/settings_dialog/notifications.spec.ts --update-snapshots

# Update all snapshots including visual snapshots
npm run test:update-snapshots
```

## Required Tags

All accessibility tests must include:

- `@accessibility` - Primary accessibility identifier
- Feature tags: `@settings`, `@notifications`, `@login`, etc.
- `@snapshots` - For tests including aria snapshots

## Best Practices

1. **Test Real User Workflows**: Focus on actual user journeys, not isolated interactions
2. **Cover All Input Methods**: Mouse, keyboard, touch, and assistive technology
3. **Test Error States**: Form validation, network errors, loading states
4. **Include Dynamic Content**: Test with various data states and configurations
5. **Document Exceptions**: When disabling accessibility rules, document the rationale
6. **Cross-Browser Testing**: Different browsers handle accessibility differently
7. **Incremental Development**: Add accessibility tests alongside feature development

## Visual Verification

For visual verification needs beyond accessibility tree structure (such as focus indicators, high contrast mode, or visual layout validation), consider adding visual screenshot tests at `specs/visual/`. Visual tests complement accessibility testing by capturing the actual rendered appearance.

See the main [README.md](../../README.md#visual-testing) for visual testing guidelines and setup.

## Getting Help

- Review existing tests in `specs/accessibility/` for patterns
- Check automated scan guidelines for axe-core usage
- See interaction testing docs for keyboard navigation patterns
- Ask questions in [~e2e-testing](https://community.mattermost.com/core/channels/e2e-testing) channels at Mattermost Community.
