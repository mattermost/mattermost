// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Field refresh (onChange → type:dialog) and multistep wizard (in-place type:dialog).
 * Stacked Details/Summary action buttons live in mm_blocks_dialog_stacking.spec.ts.
 */

import type {Locator, Page} from '@playwright/test';

import {expect, isWebhookTestServerReachable, test, testConfig} from '@mattermost/playwright-lib';

import {dialogTags, expectEphemeral, openBlocksDialogFromPost, setupDialogOpenPost} from './mm_blocks_dialog_helpers';

async function pickSelectOption(page: Page, dialog: Locator, label: string, optionName: string) {
    const field = dialog.locator('.mm-blocks-select-input').filter({hasText: label});
    await field.getByRole('combobox').click();
    await page.getByRole('option', {name: optionName}).click();
}

test.describe('Interactive mm_blocks (blocks dialog multistep / refresh)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            ].join('\n'),
        );
    });

    test(
        'field refresh changes form content and preserves project name',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'field_refresh',
                buttonText: 'Open field refresh',
                titleHint: 'mm_blocks field refresh',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('#appsModalLabel')).toContainText('Field Refresh Demo');

            const projectName = `PW Project ${pw.random.id()}`;
            await dialog.getByRole('textbox', {name: /Project Name/}).fill(projectName);

            await pickSelectOption(channelsPage.page, dialog, 'Project Type', 'Web Application');
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Framework'})).toBeVisible();
            await expect(dialog.getByRole('textbox', {name: /Project Name/})).toHaveValue(projectName);

            await pickSelectOption(channelsPage.page, dialog, 'Project Type', 'Mobile App');
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Platform'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Framework'})).toHaveCount(0);
            await expect(dialog.getByRole('textbox', {name: /Project Name/})).toHaveValue(projectName);

            await pickSelectOption(channelsPage.page, dialog, 'Project Type', 'API Service');
            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Language'})).toBeVisible();
            await expect(dialog.getByRole('textbox', {name: /Project Name/})).toHaveValue(projectName);

            await pickSelectOption(channelsPage.page, dialog, 'Language', 'Go');
            await dialog.getByRole('button', {name: 'Submit'}).click();
            await expect(dialog).toBeHidden();

            const ephemeral = await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK/);
            await expect(ephemeral).toContainText(`project_name=${projectName}`);
            await expect(ephemeral).toContainText('project_type=api');
            await expect(ephemeral).toContainText('language=go');
        },
    );

    test(
        'multistep workflow Step 1 → 2 → 3 with validation and cancel',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'multistep_1',
                buttonText: 'Open multistep',
                titleHint: 'mm_blocks multistep',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('#appsModalLabel')).toContainText('Step 1 - Personal Info');
            await expect(dialog.getByText('First Name')).toBeVisible();

            await dialog.getByRole('button', {name: 'Next Step'}).click();
            await expect(dialog).toBeVisible();
            await expect(dialog.getByTestId('first_name-error')).toBeVisible();
            await expect(dialog.locator('#appsModalLabel')).toContainText('Step 1 - Personal Info');

            await dialog.getByRole('textbox', {name: /First Name/}).fill('John');
            await dialog.getByRole('textbox', {name: /Email/}).fill('john@example.com');
            await dialog.getByRole('button', {name: 'Next Step'}).click();

            await expect(dialog.locator('#appsModalLabel')).toContainText('Step 2 - Work Info');
            await expect(dialog.getByText('Department')).toBeVisible();
            await expect(dialog.getByText('First Name')).toHaveCount(0);

            await pickSelectOption(channelsPage.page, dialog, 'Department', 'Engineering');
            await dialog.getByRole('radio', {name: 'Senior'}).click();
            await dialog.getByRole('button', {name: 'Next Step'}).click();

            await expect(dialog.locator('#appsModalLabel')).toContainText('Step 3 - Final Details');
            await expect(dialog.getByText('Comments')).toBeVisible();
            await expect(dialog.getByText('Department')).toHaveCount(0);

            await dialog.getByRole('checkbox', {name: 'I accept the terms'}).check();
            await dialog.getByRole('button', {name: 'Complete Registration'}).click();
            await expect(dialog).toBeHidden();
            await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK step=3/);
        },
    );

    test('multistep cancel from step 1', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'multistep_1',
            buttonText: 'Open multistep cancel1',
            titleHint: 'mm_blocks multistep cancel1',
        });
        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await dialog.getByRole('button', {name: 'Cancel'}).click();
        await expect(dialog).toBeHidden();
        await expectEphemeral(channelsPage.page, 'Playwright mm_blocks dialog cancelled (reason=cancel)');
    });

    test('multistep cancel from step 2', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'multistep_1',
            buttonText: 'Open multistep cancel2',
            titleHint: 'mm_blocks multistep cancel2',
        });
        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await dialog.getByRole('textbox', {name: /First Name/}).fill('Jane');
        await dialog.getByRole('textbox', {name: /Email/}).fill('jane@example.com');
        await dialog.getByRole('button', {name: 'Next Step'}).click();
        await expect(dialog.locator('#appsModalLabel')).toContainText('Step 2 - Work Info');
        await dialog.getByRole('button', {name: 'Cancel'}).click();
        await expect(dialog).toBeHidden();
        await expectEphemeral(channelsPage.page, 'Playwright mm_blocks dialog cancelled (reason=cancel)');
    });
});
