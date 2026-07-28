// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    isWebhookTestServerReachable,
    test,
    testConfig,
} from '@mattermost/playwright-lib';

import {
    dialogTags,
    expectEphemeral,
    openBlocksDialogFromPost,
    setupDialogOpenPost,
} from './mm_blocks_dialog_helpers';

test.describe('Interactive mm_blocks (blocks dialog)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
                'Or set PW_WEBHOOK_BASE_URL when it runs elsewhere.',
            ].join('\n'),
        );
    });

    test(
        'opens blocks dialog via dialogs/open using post-action trigger_id',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                actionId: 'pw_dialog_open',
                integrationPath: '/mm_blocks_dialog_open',
                buttonText: 'Open via dialogs/open',
                titleHint: 'mm_blocks dialog open',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('#appsModalLabel')).toContainText('PW Blocks (open)');
            await expect(dialog.getByText(marker)).toBeVisible();
        },
    );

    test(
        'opens blocks dialog via type:dialog response from post action',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open via return dialog',
                titleHint: 'mm_blocks dialog return',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('#appsModalLabel')).toContainText('PW Blocks (return)');
            await expect(dialog.getByText(marker)).toBeVisible();
        },
    );

    test(
        'renders form block types in a blocks dialog',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for render',
                titleHint: 'mm_blocks dialog render',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);

            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Title'})).toBeVisible();
            await expect(dialog.getByTestId('titleinput')).toHaveValue('Demo ticket');
            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Email'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-text-input').filter({hasText: 'Description'})).toBeVisible();

            await expect(dialog.locator('.mm-blocks-bool-input').filter({hasText: 'Enabled'})).toBeVisible();
            await expect(dialog.getByRole('checkbox', {name: 'Turn this on'})).toBeChecked();

            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Priority'})).toBeVisible();
            await expect(
                dialog.locator('.mm-blocks-select-input').filter({hasText: 'Priority'}).getByRole('combobox'),
            ).toHaveValue('Medium');

            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Severity'})).toBeVisible();
            await expect(dialog.getByRole('radio', {name: 'SEV-2'})).toBeChecked();

            await expect(dialog.locator('.mm-blocks-select-input').filter({hasText: 'Dynamic option'})).toBeVisible();

            await expect(dialog.locator('.mm-blocks-date-input').filter({hasText: 'Due date'})).toBeVisible();
            await expect(dialog.getByRole('button', {name: /Jan 10, 2025/i})).toBeVisible();

            await expect(dialog.locator('.mm-blocks-datetime-input').filter({hasText: 'Meeting time'})).toBeVisible();
            await expect(dialog.locator('.mm-blocks-file-input').filter({hasText: 'Attachments'})).toBeVisible();
            await expect(dialog.getByRole('button', {name: 'Choose File'})).toBeVisible();

            await expect(dialog.getByRole('button', {name: 'Submit'})).toBeVisible();
            await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
            await expect(dialog.getByRole('button', {name: 'Next step'})).toBeVisible();
            await expect(dialog.getByRole('button', {name: 'Show errors'})).toBeVisible();
        },
    );

    test(
        'submits blocks dialog form values and shows ephemeral',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for submit',
                titleHint: 'mm_blocks dialog submit',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            const titleValue = `PW dialog title ${pw.random.id()}`;

            await dialog.getByTestId('titleinput').fill(titleValue);
            await dialog.getByTestId('emailemail').fill('pw@example.com');
            await dialog.getByRole('checkbox', {name: 'Turn this on'}).uncheck();

            const prioritySelect = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Priority'});
            await prioritySelect.getByRole('combobox').click();
            await channelsPage.page.getByRole('option', {name: 'High'}).click();

            await dialog.getByRole('radio', {name: 'SEV-1'}).click();

            const dynamicSelect = dialog.locator('.mm-blocks-select-input').filter({hasText: 'Dynamic option'});
            await dynamicSelect.getByRole('combobox').click();
            await dynamicSelect.getByRole('combobox').fill('Alp');
            await expect(channelsPage.page.getByRole('option', {name: 'Alpha'})).toBeVisible();
            await channelsPage.page.getByRole('option', {name: 'Alpha'}).click();

            await dialog.locator('.mm-blocks-date-input').getByRole('button', {name: /Jan 10, 2025|Pick a due date/i}).click();
            await expect(channelsPage.page.getByRole('grid')).toBeVisible();
            await channelsPage.page.getByRole('grid').getByText('20', {exact: true}).click();

            const uploadName = `pw-dialog-file-${pw.random.id()}.txt`;
            await dialog.locator('.mm-blocks-file-input input[type="file"]').setInputFiles({
                name: uploadName,
                mimeType: 'text/plain',
                buffer: Buffer.from(`playwright blocks dialog ${pw.random.id()}\n`),
            });
            await expect(dialog.getByTestId('file-preview-item')).toBeVisible();

            await dialog.getByRole('button', {name: 'Submit'}).click();
            await expect(dialog).toBeHidden();

            const ephemeral = await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK \(/);
            await expect(ephemeral).toContainText(`title=${titleValue}`);
            await expect(ephemeral).toContainText('email=pw@example.com');
            await expect(ephemeral).toContainText('enabled=false');
            await expect(ephemeral).toContainText('priority=high');
            await expect(ephemeral).toContainText('severity=sev1');
            await expect(ephemeral).toContainText('pick=opt_alpha');
            await expect(ephemeral).toContainText(/due_date=\d{4}-\d{2}-\d{2}/);
            await expect(ephemeral).toContainText(/attachments=[a-z0-9]{26}/i);
        },
    );

    test(
        'cancel closes blocks dialog and shows ephemeral',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for cancel',
                titleHint: 'mm_blocks dialog cancel',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByRole('button', {name: 'Cancel'}).click();
            await expect(dialog).toBeHidden();

            await expectEphemeral(channelsPage.page, 'Playwright mm_blocks dialog cancelled (reason=cancel)');
        },
    );

    test(
        'header close notifies cancel and shows ephemeral',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'simple',
                buttonText: 'Open simple for X',
                titleHint: 'mm_blocks dialog x close',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await expect(dialog.locator('#appsModalLabel')).toContainText('PW Simple Dialog');
            await dialog.locator('.close').click();
            await expect(dialog).toBeHidden();
            await expectEphemeral(channelsPage.page, 'Playwright mm_blocks dialog cancelled (reason=cancel)');
        },
    );

    test(
        'simple dialog submit and cancel without form fields',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'simple',
                buttonText: 'Open simple submit',
                titleHint: 'mm_blocks simple submit',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByRole('button', {name: 'Submit'}).click();
            await expect(dialog).toBeHidden();
            await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK/);
        },
    );

    test(
        'field errors keep dialog open and surface per-field messages',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for field errors',
                titleHint: 'mm_blocks dialog field errors',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByRole('button', {name: 'Show errors'}).click();

            await expect(dialog).toBeVisible();
            await expect(dialog.getByTestId('title-error')).toHaveText('Title looks wrong');
            await expect(dialog.getByTestId('email-error')).toHaveText('Email is invalid');
            await expect(dialog.getByTestId('pick-error')).toHaveText('Pick something else');
        },
    );

    test(
        'top-level error keeps dialog open and shows action error',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for top-level error',
                titleHint: 'mm_blocks dialog top-level error',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByRole('button', {name: 'Top-level error'}).click();

            await expect(dialog).toBeVisible();
            await expect(dialog.locator('.has-error .control-label')).toHaveText(
                'Playwright mm_blocks dialog top-level error',
            );
        },
    );

    test(
        'type:refresh replaces dialog content in place',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for refresh',
                titleHint: 'mm_blocks dialog refresh',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByTestId('titleinput').fill('Refresh me');
            await dialog.getByRole('button', {name: 'Next step'}).click();

            await expect(dialog).toBeVisible();
            await expect(dialog.locator('#appsModalLabel')).toContainText('Step 2');
            await expect(dialog.getByText('Step 2 — refreshed from dialog')).toBeVisible();
            await expect(dialog.getByText(/Previous title:/)).toBeVisible();
            await expect(dialog.locator('code').getByText('Refresh me', {exact: true})).toBeVisible();
            await expect(dialog.getByTestId('notesinput')).toBeVisible();
            await expect(dialog.getByRole('checkbox', {name: 'I confirm this step'})).toBeVisible();
            await expect(dialog.getByRole('button', {name: 'Finish'})).toBeVisible();
            await expect(dialog.getByTestId('titleinput')).toHaveCount(0);
        },
    );

    test(
        'goto_location closes the blocks dialog',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                buttonText: 'Open for navigate',
                titleHint: 'mm_blocks dialog navigate',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            await dialog.getByRole('button', {name: 'Navigate away'}).click();
            await expect(dialog).toBeHidden();
        },
    );
});
