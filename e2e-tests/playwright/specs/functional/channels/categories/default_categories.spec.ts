// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';

import {settle, Api, systemConsolePath, expect, Msg, test, type App} from '@mattermost/playwright-lib';

async function enableChannelCategorySorting(adminClient: Client4) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableChannelCategorySorting: true,
        },
    });
}

async function disableChannelCategorySorting(adminClient: Client4) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableChannelCategorySorting: false,
        },
    });
}

/** Waits for the user's sidebar category named `name` on the team, and returns its id. */
async function categoryIdByName(client: Client4, userId: string, teamId: string, name: string) {
    let id = '';
    await expect
        .poll(async () => {
            const {categories} = await client.getChannelCategories(userId, teamId);
            id = categories.find((category) => category.display_name === name)?.id ?? '';
            return id;
        })
        .not.toBe('');
    return id;
}

/** Opens Channel Settings on the Info tab from the channel header menu. */
async function openChannelSettingsInfo(app: App) {
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const settings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    await expect(settings).toBeVisible();
    await expect(settings.closeButton).toBeVisible();
    await settings.tabs.tab('info').select();
    await expect(settings.tabs.tab('info')).toBeSelected();
    await expect(settings.savePanel.saveButton).not.toBeVisible();
    await expect(settings.info.name.container).toBeVisible();
    return settings;
}

/** Types a new category name in a default category selector and picks "Create new category". */
async function createCategoryIn(
    selector: App['channelSettingsModal']['info']['defaultCategory'] | App['newChannelModal']['defaultCategory'],
    name: string,
) {
    // fill focuses the input itself; a click would land on the placeholder drawn over it
    await expect(selector).toBeVisible();
    await expect(selector.inputCombobox).toBeVisible();
    await selector.inputCombobox.fill(name);
    await expect(selector.createOption).toContainText(name);
    await expect(selector.createOption).toBeVisible();
    await selector.createOption.select();
    await expect(selector.createOption).not.toBeVisible();
}

/** The channel's sidebar link inside the given category (the channel list, rooted at the category's element). */
function channelInCategory(app: App, categoryId: string, channel: Pick<Channel, 'name'>) {
    const category = app.lhs.channelList.category({id: categoryId}).locator;
    // A category has no nested channel accessor; scope the declared channel id to that category.
    return category.getByTestId(app.lhs.channelList.channel(channel).container.meta.testId);
}

test.describe('Channel Category Sorting', () => {
    /**
     * @objective Verify that the default category selector is not visible in channel settings when channel category sorting is disabled.
     */
    test(
        'default category selector is not visible when channel category sorting is disabled',
        {tag: '@channel_category_sorting'},
        async ({pw}) => {
            // # Initialize setup and disable channel category sorting
            const {adminUser, adminClient, team, townSquare} = await pw.initSetup({withDefaultProfileImage: false});
            await pw.skipIfNoLicense();
            await disableChannelCategorySorting(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open channel settings
            const {app} = await pw.testBrowser.login(adminUser);
            await app.channelsPage.goto({team, channel: townSquare});
            const settings = await openChannelSettingsInfo(app);

            // * Verify the default category selector is not rendered (the tests below see it when sorting is on)
            await expect(settings.info.defaultCategory).toHaveCount(0);

            await settings.closeButton.click();
            await expect(settings).not.toBeVisible();
        },
    );

    /**
     * @objective Verify that a default category can be assigned when creating a new channel via the new channel modal.
     */
    test(
        'default category can be assigned when creating a new channel',
        {tag: '@channel_category_sorting'},
        async ({pw}) => {
            // # Initialize setup and enable channel category sorting
            const {adminUser, adminClient, team, townSquare} = await pw.initSetup({withDefaultProfileImage: false});
            await pw.skipIfNoLicense();
            await enableChannelCategorySorting(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in and open the new channel modal
            const {app} = await pw.testBrowser.login(adminUser);
            await app.channelsPage.goto({team, channel: townSquare});
            await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.createChannelMenuItem);
            const modal = await app.lhs.browseOrAddMenu.createChannelMenuItem.clickTo(app.newChannelModal);
            const displayName = `New Default Cat ${Date.now()}`;
            await modal.name.container.fill(displayName);

            // # Pick "Create new category" in the default category selector
            await expect(modal.defaultCategory).toContainMessage(Msg.default_category.placeholder);
            await createCategoryIn(modal.defaultCategory, 'Flight Ops');

            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            // * Verify the new category appears in the sidebar
            const categoryId = await categoryIdByName(adminClient, adminUser.id, team.id, 'Flight Ops');
            await expect(app.lhs.channelList.category({id: categoryId}).headerButton).toHaveAccessibleName(
                'Flight Ops',
            );
            await expect(app.lhs.channelList.category({id: categoryId}).headerButton).toBeVisible();
        },
    );

    /**
     * @objective Verify that a Channel Admin can assign a default category to an existing channel via the channel
     * settings modal, and the category appears in the sidebar with the channel under it for the patching user.
     */
    test('default category can be assigned via channel settings', {tag: '@channel_category_sorting'}, async ({pw}) => {
        // # Initialize setup with admin user and enterprise license
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await pw.skipIfNoLicense();
        await enableChannelCategorySorting(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        // # Create a new channel and open it
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `default-assign-${Date.now()}`,
            display_name: `Default assign ${Date.now()}`,
            type: 'O',
        } as Channel);
        await adminClient.addToChannel(adminUser.id, channel.id);
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel});

        // # Open channel settings and navigate to info tab
        const settings = await openChannelSettingsInfo(app);

        // * Verify the default category selector is visible
        const selector = settings.info.defaultCategory;
        await expect(selector).toContainMessage(Msg.default_category.placeholder);

        // # Type a new category name and select "Create new category"
        await createCategoryIn(selector, 'Operations');

        // # Save and close
        await expect(settings.savePanel.saveButton).toBeVisible();
        await settle(settings.savePanel.saveButton, {wait: Api.PatchChannel}).click();
        await expect(settings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();

        // * Verify the default category appears in the sidebar with the channel under it
        const categoryId = await categoryIdByName(adminClient, adminUser.id, team.id, 'Operations');
        await expect(channelInCategory(app, categoryId, channel)).toBeVisible();
    });

    /**
     * @objective Verify that a Channel Admin can remove a default category from a channel via the channel settings
     * modal, and reopening the modal shows the field cleared.
     */
    test('default category can be removed via channel settings', {tag: '@channel_category_sorting'}, async ({pw}) => {
        // # Initialize setup and create a channel with a default category set
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await pw.skipIfNoLicense();
        await enableChannelCategorySorting(adminClient);
        await adminClient.addToTeam(team.id, adminUser.id);

        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `default-cat-remove-${Date.now()}`,
            display_name: `Default remove ${Date.now()}`,
            type: 'O',
        } as Channel);
        await adminClient.patchChannel(channel.id, {default_category_name: 'Removable'});
        await adminClient.addToChannel(adminUser.id, channel.id);

        // # Log in and navigate to the channel
        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel});

        // * Verify the default category is visible in the sidebar (admin was added after the patch set it)
        const categoryId = await categoryIdByName(adminClient, adminUser.id, team.id, 'Removable');
        await expect(channelInCategory(app, categoryId, channel)).toBeVisible();

        // # Open channel settings and clear the default category (Backspace in the empty input removes the value)
        let settings = await openChannelSettingsInfo(app);
        const selector = settings.info.defaultCategory;
        await expect(selector).toContainText('Removable');
        await selector.inputCombobox.focus();
        await selector.inputCombobox.press('Backspace');

        // * Verify the value is gone
        await expect(selector).not.toContainText('Removable');

        // # Save and close
        await expect(settings.savePanel.saveButton).toBeVisible();
        await settle(settings.savePanel.saveButton, {wait: Api.PatchChannel}).click();
        await expect(settings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);
        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();
        await expect(settings).not.toBeVisible();

        // # Reopen channel settings to verify the cleared value persisted
        settings = await openChannelSettingsInfo(app);

        // * Verify the default category selector shows the placeholder (value is cleared)
        await expect(settings.info.defaultCategory).toContainMessage(Msg.default_category.placeholder);
        await expect(settings.info.defaultCategory).not.toContainText('Removable');

        await settings.closeButton.click();
        await expect(settings).not.toBeVisible();
    });

    /**
     * @objective Verify that the Channel category sorting setting is available in the System Console
     * under Site Configuration > Users and Teams.
     */
    test(
        'Channel category sorting setting is available in System Console',
        {tag: '@channel_category_sorting'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser} = await pw.initSetup({withDefaultProfileImage: false});
            await pw.skipIfNoLicense();

            // # Log in and navigate to Users and Teams in the System Console
            const {app, page} = await pw.testBrowser.login(adminUser);
            await page.goto(systemConsolePath('site_config/users_and_teams'));

            // * Verify the setting is visible
            await expect(app.admin.setting('TeamSettings.EnableChannelCategorySorting').trueRadio).toBeVisible();
        },
    );
});
