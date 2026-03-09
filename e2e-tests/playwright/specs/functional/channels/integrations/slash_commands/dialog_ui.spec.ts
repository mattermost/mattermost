// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Command} from '@mattermost/types/integrations';

import {expect, test, initSetup, requireWebhookServer, registerWebhookDialog} from '@mattermost/playwright-lib';

const dialog = {
    callback_id: 'simple_dialog_ui',
    title: 'Title for Dialog Test without elements',
    icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
    submit_label: 'Submit Test',
    state: 'somestate',
    elements: [] as Array<Record<string, any>>,
};

/**
 * @objective Verify that a simple interactive dialog renders header, body, and footer elements correctly
 */
test(
    'MM-T2500_1 opens simple dialog and verifies header, body, and footer UI elements',
    {tag: '@interactive_dialog'},
    async ({pw}) => {
        // # Require webhook server and set up
        await requireWebhookServer();
        const {adminClient, team, user} = await initSetup();

        // # Register dialog and create slash command
        const dialogUrl = await registerWebhookDialog({name: 'test-dialog-ui', dialog});
        const command = await adminClient.addCommand({
            auto_complete: false,
            description: 'Dialog UI test',
            display_name: 'Dialog UI',
            icon_url: '',
            method: 'P',
            team_id: team.id,
            trigger: 'dialog_ui',
            url: dialogUrl,
            username: '',
        } as Command);

        // # Log in and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Trigger the dialog via slash command
        await channelsPage.postMessage(`/${command.trigger} `);

        // * Verify the dialog modal is visible
        const modal = channelsPage.page.locator('#appsModal');
        await expect(modal).toBeVisible();

        // * Verify header: icon, title, and close button
        const header = modal.locator('.modal-header');
        await expect(header.locator('#appsModalIconUrl')).toBeVisible();
        await expect(header.locator('#appsModalLabel')).toHaveText(dialog.title);
        await expect(header.locator('button.close')).toBeVisible();

        // * Verify body: no form fields (empty elements array)
        await expect(modal.locator('.modal-body')).toBeVisible();
        await expect(modal.locator('.modal-body .form-group')).toHaveCount(dialog.elements.length);

        // * Verify footer: cancel and submit buttons with correct labels
        const footer = modal.locator('.modal-footer');
        await expect(footer.locator('#appsModalCancel')).toHaveText('Cancel');
        await expect(footer.locator('#appsModalSubmit')).toHaveText(dialog.submit_label);

        // # Close the dialog via X button
        await header.locator('button.close').click();

        // * Verify the dialog is dismissed
        await expect(modal).not.toBeVisible();
    },
);
