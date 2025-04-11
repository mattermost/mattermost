# @mattermost/playwright-lib

A comprehensive end-to-end testing library for Mattermost web, desktop and plugin applications using Playwright.

## Overview

This library provides:

- Pre-built page objects and components for common Mattermost UI elements
- Server configuration and initialization utilities
- Test fixtures and helpers
- Visual testing support with Percy integration
- Accessibility testing support with [axe-core](https://github.com/dequelabs/axe-core)
- Browser notification mocking
- File handling utilities
- Common test actions and assertions

## Installation

```bash
npm install @mattermost/playwright-lib
```

## Usage

Basic example of logging in and posting a message:

```typescript
import {test, expect} from '@mattermost/playwright-lib';

test('user can post message', async ({pw}) => {
    // # Create and login a new user
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Navigate and post a message
    await channelsPage.goto();
    const message = 'Hello World!';
    await channelsPage.postMessage(message);

    // * Verify message appears
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost).toHaveText(message);
});
```

## Key Components

### Page Objects

Ready-to-use page objects for common Mattermost pages:

- Login
- Signup
- Channels
- System Console
- And more...

### UI Components

Reusable component objects for UI elements:

- Headers
- Posts
- Menus
- Modals
- And more...

### Test Utilities

Helper functions for common testing needs:

- Server setup and configuration
- User/team creation
- File handling
- Visual testing
- And more...

## Configuration

The library can be configured via optional environment variables:

### Environment Variables

All environment variables are optional with sensible defaults.

#### Server Configuration

| Variable                      | Description                                | Default                          |
| ----------------------------- | ------------------------------------------ | -------------------------------- |
| `PW_BASE_URL`                 | Server URL                                 | `http://localhost:8065`          |
| `PW_ADMIN_USERNAME`           | Admin username                             | `sysadmin`                       |
| `PW_ADMIN_PASSWORD`           | Admin password                             | `Sys@dmin-sample1`               |
| `PW_ADMIN_EMAIL`              | Admin email                                | `sysadmin@sample.mattermost.com` |
| `PW_ENSURE_PLUGINS_INSTALLED` | Comma-separated list of plugins to install | `[]`                             |
| `PW_RESET_BEFORE_TEST`        | Reset server before test                   | `false`                          |

#### High Availability Cluster Settings

| Variable                   | Description             | Default          |
| -------------------------- | ----------------------- | ---------------- |
| `PW_HA_CLUSTER_ENABLED`    | Enable HA cluster       | `false`          |
| `PW_HA_CLUSTER_NODE_COUNT` | Number of cluster nodes | `2`              |
| `PW_HA_CLUSTER_NAME`       | Cluster name            | `mm_dev_cluster` |

#### Push Notifications

| Variable                      | Description                  | Default                            |
| ----------------------------- | ---------------------------- | ---------------------------------- |
| `PW_PUSH_NOTIFICATION_SERVER` | Push notification server URL | `https://push-test.mattermost.com` |

#### Playwright Settings

| Variable      | Description                     | Default |
| ------------- | ------------------------------- | ------- |
| `PW_HEADLESS` | Run tests headless              | `true`  |
| `PW_SLOWMO`   | Add delay between actions in ms | `0`     |
| `PW_WORKERS`  | Number of parallel workers      | `1`     |

#### Visual Testing

| Variable             | Description                 | Default |
| -------------------- | --------------------------- | ------- |
| `PW_SNAPSHOT_ENABLE` | Enable snapshot testing     | `false` |
| `PW_PERCY_ENABLE`    | Enable Percy visual testing | `false` |

#### CI Settings

| Variable | Description                          | Default |
| -------- | ------------------------------------ | ------- |
| `CI`     | Set automatically in CI environments | N/A     |

## Accessibility Testing

The library includes built-in accessibility testing using [axe-core](https://github.com/dequelabs/axe-core):

```typescript
import {test, expect} from '@mattermost/playwright-lib';

test('verify login page accessibility', async ({page, axe}) => {
    // # Navigate to login page
    await page.goto('/login');

    // # Run accessibility scan
    const results = await axe.builder(page).analyze();

    // * Verify no accessibility violations
    expect(results.violations).toHaveLength(0);
});
```

The axe-core integration:

- Runs WCAG 2.0 Level A & AA rules by default
- Provides detailed violation reports
- Supports rule customization
- Can be configured per-test or globally

## Visual Testing

The library supports visual testing through [Playwright's built-in visual comparisons](https://playwright.dev/docs/test-snapshots) and [Percy](https://www.browserstack.com/percy) integration:

```typescript
import {test, expect} from '@mattermost/playwright-lib';

test('verify channel header appearance', async ({pw, browserName, viewport}, testInfo) => {
    // # Setup and login
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Navigate and prepare page
    await channelsPage.goto();
    await expect(channelsPage.appBar.playbooksIcon).toBeVisible();
    await pw.hideDynamicChannelsContent(page);

    // * Take and verify snapshot
    await pw.matchSnapshot(testInfo, {page, browserName, viewport});
});
```

## Browser Notifications

Mock and verify browser notifications:

```typescript
import {test, expect} from '@mattermost/playwright-lib';

test('verify notification on mention', async ({pw}) => {
    // # Setup users and team
    const {team, adminUser, user} = await pw.initSetup();

    // # Setup admin browser with notifications
    const {page: adminPage, channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
    await adminChannelsPage.goto(team.name, 'town-square');
    await pw.stubNotification(adminPage, 'granted');

    // # Setup user browser and post mention
    const {channelsPage: userChannelsPage} = await pw.testBrowser.login(user);
    await userChannelsPage.goto(team.name, 'off-topic');
    await userChannelsPage.postMessage(`@ALL good morning, ${team.name}!`);

    // * Verify notification received
    const notifications = await pw.waitForNotification(adminPage);
    expect(notifications.length).toBe(1);
});
```

## Contributing

See [CONTRIBUTING.md](https://github.com/mattermost/mattermost/blob/master/CONTRIBUTING.md) for development setup and guidelines.

## License

See [LICENSE.txt](https://github.com/mattermost/mattermost/blob/master/LICENSE.txt) for license information.
