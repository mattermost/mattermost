// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Multiselect, dynamic select, and users/channels selects in native block_dialog.
 */

import {expect, isWebhookTestServerReachable, test, testConfig} from '@mattermost/playwright-lib';

import {dialogTags, expectEphemeral, openBlocksDialogFromPost, setupDialogOpenPost} from './mm_blocks_dialog_helpers';

test.describe('Interactive mm_blocks (blocks dialog selects)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            ].join('\n'),
        );
    });

    test('multiselect defaults render Engineering and Marketing', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'multiselect_defaults',
            buttonText: 'Open multiselect defaults',
            titleHint: 'mm_blocks multiselect defaults',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const multi = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Multi Option Selector'});
        const chips = multi.locator('.react-select__multi-value');
        await expect(chips).toHaveCount(2);
        await expect(chips.filter({hasText: 'Engineering'})).toBeVisible();
        await expect(chips.filter({hasText: 'Marketing'})).toBeVisible();
    });

    test('multiselect add remove and submit arrays', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'multiselect',
            buttonText: 'Open multiselect clean',
            titleHint: 'mm_blocks multiselect clean',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const multi = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Multi Option Selector'});

        await multi.locator('#multiselect_options').click();
        await channelsPage.page.getByRole('option', {name: 'Engineering'}).click();
        await multi.locator('#multiselect_options').click();
        await channelsPage.page.getByRole('option', {name: 'Sales'}).click();

        await expect(multi.locator('.react-select__multi-value')).toHaveCount(2);
        await expect(multi.locator('.react-select__multi-value').filter({hasText: 'Engineering'})).toBeVisible();
        await expect(multi.locator('.react-select__multi-value').filter({hasText: 'Sales'})).toBeVisible();

        await multi
            .locator('.react-select__multi-value')
            .filter({hasText: 'Engineering'})
            .locator('.react-select__multi-value__remove')
            .click();
        await expect(multi.locator('.react-select__multi-value')).toHaveCount(1);
        await expect(multi.locator('.react-select__multi-value').filter({hasText: 'Sales'})).toBeVisible();

        const users = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Multi User Selector'});
        await users.locator('#multiselect_users').click();
        await expect(channelsPage.page.locator('.react-select__option').first()).toBeVisible();
        await channelsPage.page.locator('.react-select__option').first().click();
        await users.locator('#multiselect_users').click();
        await expect(channelsPage.page.locator('.react-select__option').nth(1)).toBeVisible();
        await channelsPage.page.locator('.react-select__option').nth(1).click();

        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog).toBeHidden();

        const ephemeral = await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK/);
        await expect(ephemeral).toContainText(/multiselect_options=.*opt2/);
    });

    test('multiselect required validation', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'multiselect',
            buttonText: 'Open multiselect required',
            titleHint: 'mm_blocks multiselect required',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('multiselect_options-error')).toContainText(/required/i);
    });

    test('multiselect keyboard navigation and type-to-filter', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'multiselect',
            buttonText: 'Open multiselect keyboard',
            titleHint: 'mm_blocks multiselect keyboard',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const multi = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Multi Option Selector'});

        // React-select focuses first option on open; one ArrowDown → Sales.
        await multi.locator('#multiselect_options').click();
        await multi.locator('#multiselect_options').press('ArrowDown');
        await multi.locator('#multiselect_options').press('Enter');
        await expect(multi.locator('.react-select__multi-value')).toHaveCount(1);
        await expect(multi.locator('.react-select__multi-value').filter({hasText: 'Sales'})).toBeVisible();

        await multi.locator('#multiselect_options').click();
        await multi.locator('#multiselect_options').fill('Prod');
        await multi.locator('#multiselect_options').press('Enter');
        await expect(multi.locator('.react-select__multi-value').filter({hasText: 'Product'})).toBeVisible();
    });

    test('dynamic select search submit and required validation', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'dynamic',
            buttonText: 'Open dynamic',
            titleHint: 'mm_blocks dynamic select',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const role = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Role'}).first();

        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog.getByTestId('dynamic_role_selector-error')).toContainText(/required/i);

        await role.getByRole('combobox').click();
        await role.getByRole('combobox').fill('Alp');
        await expect(channelsPage.page.getByRole('option', {name: 'Alpha'})).toBeVisible();
        await channelsPage.page.getByRole('option', {name: 'Alpha'}).click();

        // Search with no match — blur the menu via dialog chrome (Escape closes the whole modal).
        await role.getByRole('combobox').click();
        await role.getByRole('combobox').fill('zzz-no-match');
        await expect(channelsPage.page.getByText(/no options|no results/i)).toBeVisible();
        await dialog.locator('#appsModalLabel').click();
        await expect(channelsPage.page.getByText(/no options|no results/i)).toBeHidden();

        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog).toBeHidden();
        await expectEphemeral(channelsPage.page, /dynamic_role_selector=opt_alpha/);
    });

    test('dynamic select keyboard navigation', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'dynamic',
            buttonText: 'Open dynamic keyboard',
            titleHint: 'mm_blocks dynamic keyboard',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const role = dialog.locator('.mm-blocks-select-input').filter({hasText: /^Role/}).first();
        const input = role.getByRole('combobox');
        await input.click();
        await expect(channelsPage.page.getByRole('option').first()).toBeVisible();
        // First option is focused on open; two ArrowDown → third option.
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Enter');
        // react-select shows the pick in single-value, not the combobox value.
        await expect(role.locator('.react-select__single-value')).toHaveText('Gamma');
    });

    test('users and channels selects allow picking options', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName, adminClient, team, townSquare} = await setupDialogOpenPost(
            pw,
            request,
            {
                scenario: 'users_channels',
                buttonText: 'Open users channels',
                titleHint: 'mm_blocks users channels',
            },
        );

        // Seed extra channels so the channel list is non-trivial.
        for (let i = 0; i < 5; i++) {
            await adminClient.createPublicChannel(team.id, `PW Channel ${i}`);
        }

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);

        const userField = dialog.locator('.mm-blocks-select-input').filter({hasText: 'User Selector'});
        await userField.getByRole('combobox').click();
        await expect(channelsPage.page.locator('#suggestionList, .react-select__menu').first()).toBeVisible();
        await channelsPage.page.keyboard.press('ArrowDown');
        await channelsPage.page.keyboard.press('Enter');

        const channelField = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Channel Selector'});
        await channelField.getByRole('combobox').click();
        await expect(channelsPage.page.locator('#suggestionList, .react-select__menu').first()).toBeVisible();
        await channelsPage.page.keyboard.press('ArrowDown');
        await channelsPage.page.keyboard.press('Enter');

        await dialog.getByRole('button', {name: 'Submit'}).click();
        await expect(dialog).toBeHidden();
        await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK/);

        expect(townSquare.id).toBeTruthy();
    });
});
