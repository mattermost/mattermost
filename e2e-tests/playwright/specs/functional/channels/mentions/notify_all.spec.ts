// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, formatMessage, Msg, test} from '@mattermost/playwright-lib';

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
        const {app} = await pw.testBrowser.login(user);
        const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
        await app.channelsPage.goto({team, channel: townSquare});

        // # Send a message with @all, which asks for confirmation instead of posting
        await app.center.postCreate.message.container.fill('@all test');
        await app.center.postCreate.sendButton.click();
        await expect(app.notifyConfirmModal.confirmButton).toBeVisible();

        // * Verify the modal has the correct title text
        const modalTitle = app.page.getByRole('heading', {name: formatMessage(Msg.notify_all.title.confirm)});
        await expect(modalTitle).toBeVisible();

        // * Read the computed line-height of the modal title and assert correct spacing.
        const lineHeight = await modalTitle.evaluate((el) => {
            return window.getComputedStyle(el).lineHeight;
        });

        expect(lineHeight, `Modal title line-height should be 28px but got ${lineHeight}`).toBe('28px');
    },
);
