// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Stacked child dialogs:
 * - Legacy: action_button → executeDialogAction → dialogs/open (second modal)
 * - Native blocks: button action → dialogs/open + keep_dialog_open (parent stays open)
 */

import type {Page} from '@playwright/test';

import {expect, isWebhookTestServerReachable, test, testConfig} from '@mattermost/playwright-lib';

import {
    dialogTags,
    openBlocksDialogFromPost,
    setupDialogOpenPost,
    setupLegacyActionButtonCommand,
} from './mm_blocks_dialog_helpers';

/** All interactive dialogs share id=appsModal; use attribute selector to count stacks. */
function appsModals(page: Page) {
    return page.locator('[id="appsModal"]');
}

test.describe('Interactive dialogs (stacked child modals)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            ].join('\n'),
        );
    });

    test('legacy action_button stacks a Details child on the parent', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, trigger} = await setupLegacyActionButtonCommand(pw, request);

        await channelsPage.postMessage(`/${trigger} `);
        const parent = appsModals(channelsPage.page).first();
        await expect(parent).toBeVisible();
        await expect(parent.locator('#appsModalLabel')).toContainText('Parent Dialog with Action Button');
        await expect(parent.getByRole('button', {name: 'Open Details'})).toBeVisible();
        await expect(parent.getByRole('button', {name: 'Open Summary'})).toBeVisible();

        await parent.getByRole('button', {name: 'Open Details'}).click();

        await expect(channelsPage.page.getByText('Details Dialog')).toBeVisible();
        await expect(appsModals(channelsPage.page)).toHaveCount(2);
        await expect(channelsPage.page.getByText(/opened from the "Details" action button/i)).toBeVisible();
        await expect(channelsPage.page.getByText('Parent Dialog with Action Button')).toBeVisible();
        await expect(channelsPage.page.getByText('Summary Dialog')).toHaveCount(0);
    });

    test(
        'legacy action_button stacks a Summary child; submit returns to parent',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, trigger} = await setupLegacyActionButtonCommand(pw, request);

            await channelsPage.postMessage(`/${trigger} `);
            const parent = appsModals(channelsPage.page).first();
            await expect(parent).toBeVisible();

            await parent.getByRole('button', {name: 'Open Summary'}).click();
            await expect(channelsPage.page.getByText('Summary Dialog')).toBeVisible();
            await expect(appsModals(channelsPage.page)).toHaveCount(2);
            await expect(channelsPage.page.getByText(/opened from the "Summary" action button/i)).toBeVisible();

            const child = appsModals(channelsPage.page).filter({hasText: 'Summary Dialog'});
            await child.getByRole('button', {name: 'Submit'}).click();

            await expect(appsModals(channelsPage.page)).toHaveCount(1);
            await expect(appsModals(channelsPage.page).locator('#appsModalLabel')).toContainText(
                'Parent Dialog with Action Button',
            );
        },
    );

    test('native blocks Details button stacks a child block_dialog', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'action_parent',
            buttonText: 'Open action parent',
            titleHint: 'mm_blocks action parent',
        });

        const parent = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await expect(parent.getByRole('button', {name: 'Open Details'})).toBeVisible();
        await expect(parent.getByRole('button', {name: 'Open Summary'})).toBeVisible();

        await parent.getByRole('button', {name: 'Open Details'}).click();

        await expect(channelsPage.page.getByText('Details Dialog')).toBeVisible();
        await expect(appsModals(channelsPage.page)).toHaveCount(2);
        await expect(channelsPage.page.getByText(/opened from the.*Details/i)).toBeVisible();
        await expect(channelsPage.page.getByText('PW Action Buttons')).toBeVisible();
        await expect(channelsPage.page.getByText('Summary Dialog')).toHaveCount(0);
    });

    test('native blocks Summary child submit returns to parent', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'action_parent',
            buttonText: 'Open action parent',
            titleHint: 'mm_blocks action parent stack',
        });

        const parent = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await parent.getByRole('button', {name: 'Open Summary'}).click();

        await expect(channelsPage.page.getByText('Summary Dialog')).toBeVisible();
        await expect(appsModals(channelsPage.page)).toHaveCount(2);

        const child = appsModals(channelsPage.page).filter({hasText: 'Summary Dialog'});
        await child.getByRole('button', {name: 'Submit'}).click();

        await expect(appsModals(channelsPage.page)).toHaveCount(1);
        await expect(appsModals(channelsPage.page).locator('#appsModalLabel')).toContainText('PW Action Buttons');
    });
});
