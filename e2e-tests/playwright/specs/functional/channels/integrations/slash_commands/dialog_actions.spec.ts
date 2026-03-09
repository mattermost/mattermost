// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Command} from '@mattermost/types/integrations';
import type {UserProfile} from '@mattermost/types/users';

import {expect, test, initSetup, requireWebhookServer, registerWebhookDialog} from '@mattermost/playwright-lib';

const dialog = {
    callback_id: 'simple_dialog_actions',
    title: 'Title for Dialog Test without elements',
    icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
    submit_label: 'Submit Test',
    state: 'somestate',
    elements: [] as Array<Record<string, any>>,
};

let commandTrigger: string;
let setupTeamName: string;
let testUser: UserProfile;

test.beforeAll(async () => {
    await requireWebhookServer();

    const {adminClient, team, user} = await initSetup();
    setupTeamName = team.name;
    testUser = user;

    const dialogUrl = await registerWebhookDialog({name: 'test-dialog-actions', dialog});

    const command = await adminClient.addCommand({
        auto_complete: false,
        description: 'Dialog actions test',
        display_name: 'Dialog Actions',
        icon_url: '',
        method: 'P',
        team_id: team.id,
        trigger: 'dialog_actions',
        url: dialogUrl,
        username: '',
    } as Command);
    commandTrigger = command.trigger;
});

/**
 * @objective Verify that clicking the X button closes the interactive dialog and triggers a cancellation callback
 */
test('MM-T2500_2 closes dialog via X button and confirms cancellation', {tag: '@interactive_dialog'}, async ({pw}) => {
    // # Log in and navigate to town-square
    const {channelsPage} = await pw.testBrowser.login(testUser);
    await channelsPage.goto(setupTeamName, 'town-square');
    await channelsPage.toBeVisible();

    // # Trigger the dialog via slash command
    await channelsPage.postMessage(`/${commandTrigger} `);

    // * Verify the dialog modal is visible
    const modal = channelsPage.page.locator('#appsModal');
    await expect(modal).toBeVisible();

    // # Click the X close button
    await modal.locator('.modal-header button.close').click();

    // * Verify the dialog is dismissed
    await expect(modal).not.toBeVisible();

    // * Verify the cancellation callback posted a message
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container).toContainText('Dialog cancelled');
});

/**
 * @objective Verify that clicking the Cancel button closes the interactive dialog and triggers a cancellation callback
 */
test(
    'MM-T2500_3 closes dialog via Cancel button and confirms cancellation',
    {tag: '@interactive_dialog'},
    async ({pw}) => {
        // # Log in and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(testUser);
        await channelsPage.goto(setupTeamName, 'town-square');
        await channelsPage.toBeVisible();

        // # Trigger the dialog via slash command
        await channelsPage.postMessage(`/${commandTrigger} `);

        // * Verify the dialog modal is visible
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // # Click the Cancel button
        await modal.locator('#appsModalCancel').click();

        // * Verify the dialog is dismissed
        await expect(modal).not.toBeVisible();

        // * Verify the cancellation callback posted a message
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).toContainText('Dialog cancelled');
    },
);

/**
 * @objective Verify that clicking the Submit button closes the interactive dialog and triggers a successful submission callback
 */
test(
    'MM-T2500_4 submits dialog via Submit button and confirms submission',
    {tag: ['@smoke', '@interactive_dialog']},
    async ({pw}) => {
        // # Log in and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(testUser);
        await channelsPage.goto(setupTeamName, 'town-square');
        await channelsPage.toBeVisible();

        // # Trigger the dialog via slash command
        await channelsPage.postMessage(`/${commandTrigger} `);

        // * Verify the dialog modal is visible
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // # Click the Submit button
        await modal.locator('#appsModalSubmit').click();

        // * Verify the dialog is dismissed
        await expect(modal).not.toBeVisible();

        // * Verify the submission callback posted a message
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.container).toContainText('Dialog submitted');
    },
);
