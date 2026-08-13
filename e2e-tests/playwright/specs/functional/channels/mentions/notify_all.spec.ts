// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

// NOTIFY_ALL_MEMBERS threshold from webapp constants — modal triggers when member count > 5.
const NOTIFY_ALL_THRESHOLD = 5;

test(
    'MM-68128 notify-all confirm modal title has correct line-height',
    {tag: ['@mentions', '@visual']},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Add enough extra members so the channel member count exceeds the threshold
        for (let i = 0; i < NOTIFY_ALL_THRESHOLD; i++) {
            const extraUser = await pw.createNewUserProfile(adminClient, {prefix: 'notify-extra'});
            await adminClient.addToTeam(team.id, extraUser.id);
        }

        // # Log in and go to Town Square (all team members are in it by default)
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Type a message with @all to trigger the notify-all confirmation modal
        await channelsPage.centerView.postCreate.writeMessage('@all test');

        // # Click the Send button (without waiting for navigation — the modal will intercept)
        await channelsPage.centerView.postCreate.sendMessage();

        // # Wait for the confirm modal
        const confirmModal = channelsPage.page.locator('#confirmModal');
        await confirmModal.waitFor({state: 'visible'});

        // * Verify the modal has the correct title text
        const modalTitle = confirmModal.locator('.modal-title');
        await expect(modalTitle).toContainText('Confirm sending notifications to entire channel');

        // * Read the computed line-height of the modal title and assert correct spacing.
        const lineHeight = await modalTitle.evaluate((el) => {
            return window.getComputedStyle(el).lineHeight;
        });

        expect(lineHeight, `Modal title line-height should be 28px but got ${lineHeight}`).toBe('28px');
    },
);
