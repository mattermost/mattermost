// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {systemConsolePath, Api, expect, settle, test, duration} from '@mattermost/playwright-lib';

// Wait for the GET /api/v4/config re-fetch that our config_changed websocket
// handler triggers. This is the signal that entities.admin.config in the
// browser's Redux store is now up-to-date with the server's current state.
async function waitForAdminConfigRefresh(page: import('@playwright/test').Page) {
    return page.waitForResponse(
        (resp) => resp.url().endsWith('/api/v4/config') && resp.request().method() === 'GET' && resp.status() === 200,
        {timeout: duration.ten_sec},
    );
}

// Each test case opens a System Console page, makes a parallel API change to a
// completely separate config section (simulating another admin), then saves the
// open page and asserts both changes survived.
test.describe('System Console > Concurrent config saves', () => {
    test('Emoji page: parallel change to TeamSettings is not clobbered', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Set a known baseline for both sections under test
        await adminClient.patchConfig({
            ServiceSettings: {EnableCustomEmoji: false},
            TeamSettings: {MaxUsersPerTeam: 50},
        } as Partial<AdminConfig>);

        // # Open the Emoji settings page
        const {app, page} = await pw.testBrowser.login(adminUser);
        await page.goto(systemConsolePath('site_config/emoji'));
        await expect(app.admin.screen('EmojiSettings')).toBeVisible();

        // # Simulate another admin saving an unrelated section via API.
        // Set up the response listener before triggering the change so we don't
        // miss the GET /api/v4/config that our config_changed handler dispatches.
        const configRefresh = waitForAdminConfigRefresh(page);
        await adminClient.patchConfig({TeamSettings: {MaxUsersPerTeam: 99}} as Partial<AdminConfig>);

        // # Wait for the browser to re-fetch the admin config, so the page's config is fresh, and check the
        // setting's current state has reached the UI before changing it
        await configRefresh;
        const toggle = app.admin.setting('ServiceSettings.EnableCustomEmoji').trueRadio;
        await expect(toggle).not.toBeChecked();

        // # Change the setting and save
        await toggle.check();
        await expect(toggle).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

        // * Both the UI change and the parallel API change must be present
        const finalConfig = await adminClient.getConfig();
        expect(finalConfig.ServiceSettings.EnableCustomEmoji).toBe(true);
        expect(finalConfig.TeamSettings.MaxUsersPerTeam).toBe(99);
    });

    test('Announcement Banner page: parallel change to ServiceSettings is not clobbered', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Set a known baseline for both sections under test
        await adminClient.patchConfig({
            AnnouncementSettings: {EnableBanner: false},
            ServiceSettings: {EnableCustomEmoji: false},
        } as Partial<AdminConfig>);

        // # Open the Announcement Banner settings page
        const {app, page} = await pw.testBrowser.login(adminUser);
        await page.goto(systemConsolePath('site_config/announcement_banner'));
        await expect(app.admin.screen('AnnouncementSettings')).toBeVisible();

        // # Simulate another admin saving an unrelated section via API.
        // Set up the response listener before triggering the change so we don't
        // miss the GET /api/v4/config that our config_changed handler dispatches.
        const configRefresh = waitForAdminConfigRefresh(page);
        await adminClient.patchConfig({ServiceSettings: {EnableCustomEmoji: true}} as Partial<AdminConfig>);

        // # Wait for the browser to re-fetch the admin config, so the page's config is fresh, and check the
        // setting's current state has reached the UI before changing it
        await configRefresh;
        const toggle = app.admin.setting('AnnouncementSettings.EnableBanner').trueRadio;
        await expect(toggle).not.toBeChecked();

        // # Change the setting and save
        await toggle.check();
        await expect(toggle).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

        // * Both changes must be present
        const finalConfig = await adminClient.getConfig();
        expect(finalConfig.AnnouncementSettings.EnableBanner).toBe(true);
        expect(finalConfig.ServiceSettings.EnableCustomEmoji).toBe(true);
    });

    test('Users and Teams page: parallel change to EmailSettings is not clobbered', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Set a known baseline for both sections under test
        await adminClient.patchConfig({
            TeamSettings: {EnableJoinLeaveMessageByDefault: false},
            EmailSettings: {EnableSignUpWithEmail: true},
        } as Partial<AdminConfig>);

        // # Open the Users and Teams settings page
        const {app, page} = await pw.testBrowser.login(adminUser);
        await page.goto(systemConsolePath('site_config/users_and_teams'));
        await expect(app.admin.screen('UserAndTeamsSettings')).toBeVisible();

        // # Simulate another admin saving an unrelated section via API.
        // Set up the response listener before triggering the change so we don't
        // miss the GET /api/v4/config that our config_changed handler dispatches.
        const configRefresh = waitForAdminConfigRefresh(page);
        await adminClient.patchConfig({EmailSettings: {EnableSignUpWithEmail: false}} as Partial<AdminConfig>);

        // # Wait for the browser to re-fetch the admin config, so the page's config is fresh, and check the
        // setting's current state has reached the UI before changing it
        await configRefresh;
        const toggle = app.admin.setting('TeamSettings.EnableJoinLeaveMessageByDefault').trueRadio;
        await expect(toggle).not.toBeChecked();

        // # Change the setting and save
        await toggle.check();
        await expect(toggle).toBeChecked();
        await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();

        // * Both changes must be present
        const finalConfig = await adminClient.getConfig();
        expect(finalConfig.TeamSettings.EnableJoinLeaveMessageByDefault).toBe(true);
        expect(finalConfig.EmailSettings.EnableSignUpWithEmail).toBe(false);
    });
});
