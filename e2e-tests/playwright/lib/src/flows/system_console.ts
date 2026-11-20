// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import type {TestBrowser} from '@/browser_context';
import {AdminConsolePage, type App} from '@/ui/generated';
import {expect} from '@/aria/matchers';

/** The generated admin route with a System Console section appended. */
export function systemConsolePath(section: string): string {
    return `${AdminConsolePage.path()}/${section}`;
}

/** Opens a System Console section once the navigation shell is visible. */
export async function openSystemConsoleSection(app: App, section = ''): Promise<void> {
    await app.page.goto(section ? systemConsolePath(section) : AdminConsolePage.path());
    await expect(app.backstage.navbar).toBeVisible();
    await expect(app.backstage.navbar.backLink).toBeVisible();
    await expect(app.admin.sidebar).toBeVisible();
}

/**
 * Logs the admin in and opens System Console > Users: `const app = await openSystemUsers(pw, adminUser)`. Returns
 * once the search box and the table's first row show.
 */
export async function openSystemUsers(pw: {testBrowser: TestBrowser}, admin: UserProfile): Promise<App> {
    const {app} = await pw.testBrowser.login(admin);
    await openSystemConsoleSection(app, 'user_management/users');
    await expect(app.backstage.navbar).toBeVisible();
    await expect(app.backstage.navbar.backLink).toBeVisible();
    await expect(app.admin.sidebar).toBeVisible();
    await expect(app.admin.users).toBeVisible();
    // The header also contains actions; its title has no separate generated member.
    await expect(app.admin.header.locator.getByText('Mattermost Users', {exact: true})).toBeVisible();
    await expect(app.admin.users.search.container).toBeVisible();
    await expect(await app.admin.users.table.rowList.first()).toBeVisible();
    return app;
}

/** Searches the System Console users table (the box debounces) and returns once `expected`'s row shows. */
export async function searchSystemUsers(app: App, term: string, expected: Pick<UserProfile, 'id'>): Promise<void> {
    await app.admin.users.search.container.fill(term);
    await expect(app.admin.users.table.row(expected.id)).toBeVisible();
}
