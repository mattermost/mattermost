// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import type {ChannelCategory} from '@mattermost/types/channel_categories';

import {expect, test, DefaultChannel} from '@mattermost/playwright-lib';
import type {App, PlaywrightExtended} from '@mattermost/playwright-lib';

const categoryName = 'Noisy';
const unreadChannelName = 'noisy-unread';
const mutedChannelName = 'noisy-muted';
const openChannelName = 'noisy-open';

/**
 * Creates a "Noisy" category for the user with three channels:
 * - noisy-unread: has a new message, so it is unread
 * - noisy-muted: is muted and has a message that mentions the user
 * - noisy-open: has a new message, and the test opens it to make it the current channel
 */
async function setupNoisyCategory(pw: PlaywrightExtended, collapseCategoryWithUnreads?: boolean) {
    const {user, userClient, adminClient, team} = await pw.initSetup();

    const channelIds: Record<string, string> = {};
    for (const name of [unreadChannelName, mutedChannelName, openChannelName]) {
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name,
            display_name: name,
            type: 'O',
        });
        await adminClient.addToChannel(user.id, channel.id);
        channelIds[name] = channel.id;
    }

    const category = await userClient.createChannelCategory(user.id, team.id, {
        team_id: team.id,
        user_id: user.id,
        display_name: categoryName,
        channel_ids: Object.values(channelIds),
    });

    await userClient.updateChannelNotifyProps({
        channel_id: channelIds[mutedChannelName],
        user_id: user.id,
        mark_unread: 'mention',
    });

    if (collapseCategoryWithUnreads !== undefined) {
        await userClient.savePreferences(user.id, [
            {
                user_id: user.id,
                category: 'display_settings',
                name: 'collapse_category_with_unreads',
                value: String(collapseCategoryWithUnreads),
            },
        ]);
    }

    // # Post as the admin so the channels are unread for the user
    await adminClient.createPost({channel_id: channelIds[unreadChannelName], message: 'Deploy finished'});
    await adminClient.createPost({channel_id: channelIds[openChannelName], message: 'Nightly build passed'});
    await adminClient.createPost({
        channel_id: channelIds[mutedChannelName],
        message: `@${user.username} can you take a look?`,
    });

    return {user, userClient, team, category};
}

/**
 * The category's header button (collapses and expands it) and the sidebar link of a channel in it, on the generated
 * page objects.
 */
function sidebarOf(app: App, category: ChannelCategory) {
    const categoryHeader = app.lhs.channelList.category(category).headerButton.locator;
    const channelLink = (name: string) => app.lhs.channelList.channel({name}).locator;
    return {categoryHeader, channelLink};
}

/** Collapses the category from its header. */
async function collapse(categoryHeader: Locator) {
    await expect(categoryHeader).toHaveAccessibleName(categoryName);
    await categoryHeader.click();
    await expect(categoryHeader).toHaveAttribute('aria-expanded', 'false');
}

test.describe('Collapse category with unread channels', () => {
    /**
     * @objective Verify that a collapsed category keeps its unread channels visible when the setting is off
     */
    test(
        'keeps unread channels in a collapsed category when the setting is off',
        {tag: '@channel_sidebar'},
        async ({pw}) => {
            // # Set up the category without saving the setting, so the default (off) applies
            const {user, team, category} = await setupNoisyCategory(pw);

            // # Log in and open Town Square
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

            const {categoryHeader, channelLink} = sidebarOf(app, category);

            // * Verify the channels are unread and the muted channel has a mention count
            await expect(channelLink(unreadChannelName)).toHaveClass(/unread|unread-title/);
            await expect(app.lhs.channelList.channel({name: mutedChannelName}).mentionBadgeText.locator).toBeVisible();

            // # Collapse the category
            await collapse(categoryHeader);

            // * Verify the unread channel and the muted channel with a mention stay visible
            await expect(channelLink(unreadChannelName)).toBeVisible();
            await expect(channelLink(mutedChannelName)).toBeVisible();
            await expect(channelLink(openChannelName)).toBeVisible();
        },
    );

    /**
     * @objective Verify that turning the setting on in Display settings saves it and hides unread channels in a
     * collapsed category
     */
    test(
        'hides unread channels in a collapsed category when the setting is on',
        {tag: '@channel_sidebar'},
        async ({pw}) => {
            // # Set up the category without saving the setting
            const {user, userClient, team, category} = await setupNoisyCategory(pw);

            // # Log in and open Town Square
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

            // # Open Settings > Display and turn the setting on
            await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
            await app.userSettingsModal.tabs.tab('display').select();
            const section = app.settings.display.section('collapse_category_with_unreads');
            const options = section.collapseCategoryWithUnreads;
            await expect(section.container).toBeVisible();
            await section.editButton.click();

            // (the section is expanded: its row with the Edit button gave way to the form with Cancel)
            await expect(section.editButton.locator).not.toBeVisible();
            await expect(section.cancelButton.locator).toBeVisible();

            await expect(options.option('true').locator).toHaveAccessibleName('On');
            await options.option('true').check();
            await expect(options.option('true')).toBeChecked();
            await section.saveButton.click();
            await expect(section.describeText.locator).toHaveText('On');
            await app.userSettingsModal.closeButton.click();
            await expect(app.userSettingsModal.locator).not.toBeVisible();

            // * Verify the save wrote the value true
            await expect
                .poll(async () => {
                    const preferences = await userClient.getUserPreferences(user.id);
                    return preferences.find(
                        (preference) =>
                            preference.category === 'display_settings' &&
                            preference.name === 'collapse_category_with_unreads',
                    )?.value;
                })
                .toBe('true');

            const {categoryHeader, channelLink} = sidebarOf(app, category);

            // # Collapse the category
            await collapse(categoryHeader);

            // * Verify the unread channel and the muted channel with a mention are hidden
            await expect(channelLink(unreadChannelName)).not.toBeVisible();
            await expect(channelLink(mutedChannelName)).not.toBeVisible();
            await expect(channelLink(openChannelName)).not.toBeVisible();

            // # Expand the category
            await categoryHeader.click();
            await expect(categoryHeader).toHaveAttribute('aria-expanded', 'true');

            // * Verify every channel is visible in the open category
            await expect(channelLink(unreadChannelName)).toBeVisible();
            await expect(channelLink(mutedChannelName)).toBeVisible();
            await expect(channelLink(openChannelName)).toBeVisible();
        },
    );

    /**
     * @objective Verify that a collapsed category keeps the current channel visible when the setting is on
     */
    test(
        'keeps the current channel in a collapsed category when the setting is on',
        {tag: '@channel_sidebar'},
        async ({pw}) => {
            // # Set up the category with the setting on
            const {user, team, category} = await setupNoisyCategory(pw, true);

            // # Log in and open a channel in the category
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: openChannelName});

            const {categoryHeader, channelLink} = sidebarOf(app, category);

            // # Collapse the category
            await collapse(categoryHeader);

            // * Verify only the current channel stays visible
            await expect(channelLink(openChannelName)).toBeVisible();
            await expect(channelLink(unreadChannelName)).not.toBeVisible();
            await expect(channelLink(mutedChannelName)).not.toBeVisible();
        },
    );
});
