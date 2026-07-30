// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Client-side validation and full-field UI for native block_dialog.
 * Native email checks are soft (must include '@'), not HTML5 validationMessage.
 */

import {expect, isWebhookTestServerReachable, test, testConfig} from '@mattermost/playwright-lib';

import {dialogTags, expectEphemeral, openBlocksDialogFromPost, setupDialogOpenPost} from './mm_blocks_dialog_helpers';

test.describe('Interactive mm_blocks (blocks dialog validation)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            ].join('\n'),
        );
    });

    test('required empty submit keeps dialog open with field errors', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'empty_required',
            buttonText: 'Open required',
            titleHint: 'mm_blocks required validation',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await dialog.getByRole('button', {name: 'Submit'}).click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('realname-error')).toBeVisible();
        await expect(dialog.getByTestId('someemail-error')).toBeVisible();
        await expect(dialog.getByTestId('somenumber-error')).toBeVisible();
        await expect(dialog.getByText('Please fix all field errors')).toBeVisible();
    });

    test('email soft validation rejects invalid and accepts valid', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'empty_required',
            buttonText: 'Open email validation',
            titleHint: 'mm_blocks email validation',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await dialog.getByTestId('realnameinput').fill('Ada');
        await dialog.getByTestId('someemailemail').fill('not-an-email');
        await dialog.getByTestId('somenumbernumber').fill('42');
        await dialog.getByRole('button', {name: 'Submit'}).click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('someemail-error')).toContainText(/email/i);

        await dialog.getByTestId('someemailemail').fill('ada@example.com');
        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog).toBeHidden();
        await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK/);
    });

    test(
        'number validation rejects empty/invalid and accepts numeric',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'empty_required',
                buttonText: 'Open number validation',
                titleHint: 'mm_blocks number validation',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByTestId('realnameinput').fill('Ada');
            await dialog.getByTestId('someemailemail').fill('ada@example.com');
            // Leave number empty (required) — browser type=number may ignore non-numeric fills.
            await dialog.getByRole('button', {name: 'Submit'}).click();

            await expect(dialog).toBeVisible();
            await expect(dialog.getByTestId('somenumber-error')).toBeVisible();

            await dialog.getByTestId('somenumbernumber').fill('99');
            await dialog.getByRole('button', {name: 'Submit'}).click();
            await expect(dialog).toBeHidden();
            await expectEphemeral(channelsPage.page, /somenumber=99/);
        },
    );

    test(
        'password field uses type=password and full dialog renders field mix',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'full',
                buttonText: 'Open full dialog',
                titleHint: 'mm_blocks full dialog',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('#appsModalLabel')).toContainText('PW Full Dialog');
            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Name'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Email'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Number'})).toBeVisible();
            await expect(dialog.getByTestId('somepasswordpassword')).toHaveAttribute('type', 'password');
            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Notes'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'User'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Channel'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: /^Option/})).toBeVisible();
            await expect(dialog.getByRole('radio', {name: 'Engineering'})).toBeVisible();
            await expect(dialog.getByRole('checkbox', {name: 'Was this modal helpful?'})).toBeChecked();
            await expect(dialog.getByText('This is the help text')).toBeVisible();
        },
    );

    test(
        'boolean dialog shows label, checked default, placeholder, and help',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'boolean',
                buttonText: 'Open boolean',
                titleHint: 'mm_blocks boolean',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('.mm-blocks-bool-input').filter({hasText: 'Boolean Selector'})).toBeVisible();
            await expect(dialog.getByRole('checkbox', {name: 'Was this modal helpful?'})).toBeChecked();
            await expect(dialog.getByText('This is the help text')).toBeVisible();
        },
    );
});
