// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

// -- Theme color constants from webapp/channels/src/packages/mattermost-redux/src/constants/preferences.ts --

const denimTheme = {
    type: 'Denim',
    sidebarBg: '#1e325c',
    sidebarText: '#ffffff',
    sidebarUnreadText: '#ffffff',
    sidebarTextHoverBg: '#28427b',
    sidebarTextActiveBorder: '#5d89ea',
    sidebarTextActiveColor: '#ffffff',
    sidebarHeaderBg: '#192a4d',
    sidebarHeaderTextColor: '#ffffff',
    sidebarTeamBarBg: '#162545',
    onlineIndicator: '#3db887',
    awayIndicator: '#ffbc1f',
    dndIndicator: '#d24b4e',
    mentionBg: '#ffffff',
    mentionColor: '#1e325c',
    centerChannelBg: '#ffffff',
    centerChannelColor: '#3f4350',
    newMessageSeparator: '#cc8f00',
    linkColor: '#386fe5',
    buttonBg: '#1c58d9',
    buttonColor: '#ffffff',
    errorTextColor: '#d24b4e',
    mentionHighlightBg: '#ffd470',
    mentionHighlightLink: '#1b1d22',
    codeTheme: 'github',
};

const onyxTheme = {
    type: 'Onyx',
    sidebarBg: '#202228',
    sidebarText: '#ffffff',
    sidebarUnreadText: '#ffffff',
    sidebarTextHoverBg: '#25262a',
    sidebarTextActiveBorder: '#4a7ce8',
    sidebarTextActiveColor: '#ffffff',
    sidebarHeaderBg: '#24272d',
    sidebarHeaderTextColor: '#ffffff',
    sidebarTeamBarBg: '#292c33',
    onlineIndicator: '#3db887',
    awayIndicator: '#f5ab00',
    dndIndicator: '#d24b4e',
    mentionBg: '#4b7ce7',
    mentionColor: '#ffffff',
    centerChannelBg: '#191b1f',
    centerChannelColor: '#e3e4e8',
    newMessageSeparator: '#1adbdb',
    linkColor: '#5d89ea',
    buttonBg: '#4a7ce8',
    buttonColor: '#ffffff',
    errorTextColor: '#da6c6e',
    mentionHighlightBg: '#0d6e6e',
    mentionHighlightLink: '#a4f4f4',
    codeTheme: 'monokai',
};

const indigoTheme = {
    type: 'Indigo',
    sidebarBg: '#151e32',
    sidebarText: '#ffffff',
    sidebarUnreadText: '#ffffff',
    sidebarTextHoverBg: '#222c3f',
    sidebarTextActiveBorder: '#4a7ce8',
    sidebarTextActiveColor: '#ffffff',
    sidebarHeaderBg: '#182339',
    sidebarHeaderTextColor: '#ffffff',
    sidebarTeamBarBg: '#1c2740',
    onlineIndicator: '#3db887',
    awayIndicator: '#f5ab00',
    dndIndicator: '#d24b4e',
    mentionBg: '#4a7ce8',
    mentionColor: '#ffffff',
    centerChannelBg: '#111827',
    centerChannelColor: '#dddfe4',
    newMessageSeparator: '#81a3ef',
    linkColor: '#5d89ea',
    buttonBg: '#4a7ce8',
    buttonColor: '#ffffff',
    errorTextColor: '#d24b4e',
    mentionHighlightBg: '#133a91',
    mentionHighlightLink: '#a4f4f4',
    codeTheme: 'solarized-dark',
};

/**
 * Polls CSS custom properties from the document root until they match the expected theme values.
 * Uses expect.poll to handle async theme application after emulateMedia changes.
 */
async function expectThemeApplied(page: Page, themeVars: {centerChannelBg: string; sidebarBg: string}) {
    await expect
        .poll(
            async () => {
                return page.evaluate(() =>
                    getComputedStyle(document.documentElement).getPropertyValue('--center-channel-bg').trim(),
                );
            },
            {timeout: 5000},
        )
        .toBe(themeVars.centerChannelBg);

    await expect
        .poll(
            async () => {
                return page.evaluate(() =>
                    getComputedStyle(document.documentElement).getPropertyValue('--sidebar-bg').trim(),
                );
            },
            {timeout: 5000},
        )
        .toBe(themeVars.sidebarBg);
}

test('Auto-switch disabled -- OS dark mode has no effect on theme', async ({pw}) => {
    // Setup: create user with default (Denim) theme, auto-switch OFF
    const {user, userClient, team} = await pw.initSetup();

    // Explicitly set the Denim light theme and ensure auto-switch is off
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'theme', name: team.id, value: JSON.stringify(denimTheme)},
    ]);

    // Login and navigate to channels
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // Emulate OS dark mode
    await page.emulateMedia({colorScheme: 'dark'});

    // Assert CSS variables still reflect the Denim light theme
    await expectThemeApplied(page, {centerChannelBg: denimTheme.centerChannelBg, sidebarBg: denimTheme.sidebarBg});
});

test('Auto-switch enabled + OS dark mode -- applies dark theme', async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();

    // Enable auto-switch and set Onyx as the default dark theme
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'theme', name: team.id, value: JSON.stringify(denimTheme)},
        {user_id: user.id, category: 'display_settings', name: 'theme_auto_switch', value: 'true'},
        {user_id: user.id, category: 'theme_dark', name: '', value: JSON.stringify(onyxTheme)},
    ]);

    // Login and emulate OS dark mode before navigating
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await page.emulateMedia({colorScheme: 'dark'});
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // Assert CSS variables match the Onyx dark theme
    await expectThemeApplied(page, {centerChannelBg: onyxTheme.centerChannelBg, sidebarBg: onyxTheme.sidebarBg});
});

test('Auto-switch enabled + OS light mode -- keeps light theme', async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();

    // Enable auto-switch and set Onyx as dark theme
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'theme', name: team.id, value: JSON.stringify(denimTheme)},
        {user_id: user.id, category: 'display_settings', name: 'theme_auto_switch', value: 'true'},
        {user_id: user.id, category: 'theme_dark', name: '', value: JSON.stringify(onyxTheme)},
    ]);

    // Login and navigate
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // Emulate OS light mode
    await page.emulateMedia({colorScheme: 'light'});

    // Assert CSS variables match the Denim light theme
    await expectThemeApplied(page, {centerChannelBg: denimTheme.centerChannelBg, sidebarBg: denimTheme.sidebarBg});
});

test('Runtime toggle -- OS changes from light to dark while app is open', async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();

    // Enable auto-switch with Onyx as dark theme
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'theme', name: team.id, value: JSON.stringify(denimTheme)},
        {user_id: user.id, category: 'display_settings', name: 'theme_auto_switch', value: 'true'},
        {user_id: user.id, category: 'theme_dark', name: '', value: JSON.stringify(onyxTheme)},
    ]);

    // Login and navigate with light mode
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await page.emulateMedia({colorScheme: 'light'});
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // Assert light theme is active
    await expectThemeApplied(page, {centerChannelBg: denimTheme.centerChannelBg, sidebarBg: denimTheme.sidebarBg});

    // Toggle to OS dark mode at runtime
    await page.emulateMedia({colorScheme: 'dark'});

    // Assert CSS variables update to Onyx dark theme
    await expectThemeApplied(page, {centerChannelBg: onyxTheme.centerChannelBg, sidebarBg: onyxTheme.sidebarBg});
});

test('Team-specific dark themes -- switching teams applies different dark themes', async ({pw}) => {
    const {user, userClient, team, adminClient} = await pw.initSetup();

    // Create a second team and add the user to it
    const team2 = await pw.createNewTeam(adminClient, {name: 'team2', displayName: 'Team 2'});
    await adminClient.addToTeam(team2.id, user.id);

    // Set different dark themes per team:
    //   team 1 → Onyx dark theme
    //   team 2 → Indigo dark theme
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'theme', name: team.id, value: JSON.stringify(denimTheme)},
        {user_id: user.id, category: 'theme', name: team2.id, value: JSON.stringify(denimTheme)},
        {user_id: user.id, category: 'display_settings', name: 'theme_auto_switch', value: 'true'},
        {user_id: user.id, category: 'theme_dark', name: team.id, value: JSON.stringify(onyxTheme)},
        {user_id: user.id, category: 'theme_dark', name: team2.id, value: JSON.stringify(indigoTheme)},
    ]);

    // Login with dark mode emulated
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await page.emulateMedia({colorScheme: 'dark'});

    // Navigate to team 1 and assert Onyx dark theme
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();
    await expectThemeApplied(page, {centerChannelBg: onyxTheme.centerChannelBg, sidebarBg: onyxTheme.sidebarBg});

    // Navigate to team 2 and assert Indigo dark theme
    await channelsPage.goto(team2.name);
    await channelsPage.toBeVisible();
    await expectThemeApplied(page, {centerChannelBg: indigoTheme.centerChannelBg, sidebarBg: indigoTheme.sidebarBg});
});
