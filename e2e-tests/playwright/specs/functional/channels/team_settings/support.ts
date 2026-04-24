// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {ChannelsPage} from '@mattermost/playwright-lib';

import {enableABACConfig, ensureDepartmentAttribute} from './helpers';

// Re-export helpers so spec files can import everything from a single module if desired.
export * from './helpers';

/**
 * Common setup for ABAC-related Team Settings tests:
 * skip-if-no-license + initSetup + enable ABAC config + ensure Department attribute.
 *
 * Returns the full initSetup result so callers can destructure what they need.
 */
export async function setupTeamWithABAC(pw: any) {
    await pw.skipIfNoLicense();
    const setup = await pw.initSetup();
    await enableABACConfig(setup.adminClient);
    await ensureDepartmentAttribute(setup.adminClient);
    return setup;
}

/**
 * Logs in as the given user, navigates to the team, and opens the Team Settings modal.
 * Returns the page, channelsPage, and teamSettings modal handle.
 */
export async function loginAndOpenTeamSettings(pw: any, user: any, teamName?: string) {
    const {page} = await pw.testBrowser.login(user);
    const channelsPage = new ChannelsPage(page);
    if (teamName) {
        await channelsPage.goto(teamName);
    } else {
        await channelsPage.goto();
    }
    await channelsPage.toBeVisible();

    const teamSettings = await channelsPage.openTeamSettings();
    return {page: page as Page, channelsPage, teamSettings};
}

/**
 * Logs in as the given user, navigates to the team, opens Team Settings modal,
 * and switches to the Access Policies tab.
 */
export async function loginAndOpenPoliciesTab(pw: any, user: any, teamName?: string) {
    const result = await loginAndOpenTeamSettings(pw, user, teamName);
    await result.teamSettings.openAccessPoliciesTab();
    return result;
}
