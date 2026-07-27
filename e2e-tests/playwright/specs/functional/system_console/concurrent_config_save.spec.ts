// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

// Wait for the GET /api/v4/config re-fetch that our config_changed websocket
// handler triggers. This is the signal that entities.admin.config in the
// browser's Redux store is now up-to-date with the server's current state.
async function waitForAdminConfigRefresh(page: import('@playwright/test').Page) {
    return page.waitForResponse(
        (resp) => resp.url().endsWith('/api/v4/config') && resp.request().method() === 'GET' && resp.status() === 200,
        {timeout: 10000},
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
        const {page} = await pw.testBrowser.login(adminUser);
        await page.goto('/admin_console/site_config/emoji');

        const emojiSection = page.getByTestId('sysconsole_section_EmojiSettings');
        await expect(emojiSection).toBeVisible();
        const saveButton = emojiSection.getByRole('button', {name: 'Save'});

        // # Simulate another admin saving an unrelated section via API.
        // Set up the response listener before triggering the change so we don't
        // miss the GET /api/v4/config that our config_changed handler dispatches.
        const configRefresh = waitForAdminConfigRefresh(page);
        await adminClient.patchConfig({TeamSettings: {MaxUsersPerTeam: 99}} as Partial<AdminConfig>);

        // # Wait for the browser to re-fetch the admin config before we save,
        // confirming that this.props.config is now fresh. Then assert the
        // toggle's current state to confirm the Redux store update has
        // propagated to the UI before we interact.
        await configRefresh;
        const emojiToggle = emojiSection.getByTestId('ServiceSettings.EnableCustomEmojitrue');
        await expect(emojiToggle).not.toBeChecked();

        // # Change a setting on the open Emoji page and save
        await emojiToggle.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

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
        const {page} = await pw.testBrowser.login(adminUser);
        await page.goto('/admin_console/site_config/announcement_banner');

        const bannerSection = page.getByTestId('sysconsole_section_AnnouncementSettings');
        await expect(bannerSection).toBeVisible();
        const saveButton = bannerSection.getByRole('button', {name: 'Save'});

        // # Simulate another admin saving an unrelated section via API
        const configRefresh = waitForAdminConfigRefresh(page);
        await adminClient.patchConfig({ServiceSettings: {EnableCustomEmoji: true}} as Partial<AdminConfig>);
        await configRefresh;
        const bannerToggle = bannerSection.getByTestId('AnnouncementSettings.EnableBannertrue');
        await expect(bannerToggle).not.toBeChecked();

        // # Change a setting on the open Announcement Banner page and save
        await bannerToggle.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

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
        const {page} = await pw.testBrowser.login(adminUser);
        await page.goto('/admin_console/site_config/users_and_teams');

        const teamSection = page.getByTestId('sysconsole_section_UserAndTeamsSettings');
        await expect(teamSection).toBeVisible();
        const saveButton = teamSection.getByRole('button', {name: 'Save'});

        // # Simulate another admin saving EmailSettings via API
        const configRefresh = waitForAdminConfigRefresh(page);
        await adminClient.patchConfig({EmailSettings: {EnableSignUpWithEmail: false}} as Partial<AdminConfig>);
        await configRefresh;
        const joinLeaveToggle = teamSection.getByTestId('TeamSettings.EnableJoinLeaveMessageByDefaulttrue');
        await expect(joinLeaveToggle).not.toBeChecked();

        // # Toggle Enable Join/Leave messages on the Users and Teams page and save
        await joinLeaveToggle.click();
        await saveButton.click();
        await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

        // * Both changes must be present
        const finalConfig = await adminClient.getConfig();
        expect(finalConfig.TeamSettings.EnableJoinLeaveMessageByDefault).toBe(true);
        expect(finalConfig.EmailSettings.EnableSignUpWithEmail).toBe(false);
    });
});
