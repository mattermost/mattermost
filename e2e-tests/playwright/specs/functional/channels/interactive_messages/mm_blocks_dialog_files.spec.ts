// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * File upload fields in native block_dialog (single replace vs allow_multiple append).
 */

import {expect, isWebhookTestServerReachable, test, testConfig} from '@mattermost/playwright-lib';

import {dialogTags, expectEphemeral, openBlocksDialogFromPost, setupDialogOpenPost} from './mm_blocks_dialog_helpers';

function fakeFile(name: string, contents: string) {
    return {
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from(contents),
    };
}

test.describe('Interactive mm_blocks (blocks dialog files)', () => {
    test.beforeEach(async ({request}) => {
        test.skip(
            !(await isWebhookTestServerReachable(request)),
            [
                `Webhook test server is not reachable at ${testConfig.webhookBaseUrl}.`,
                'Start it from the repo: cd e2e-tests/cypress && npm run start:webhook',
            ].join('\n'),
        );
    });

    test('renders Choose File vs Choose Files labels', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'file_upload',
            buttonText: 'Open file upload UI',
            titleHint: 'mm_blocks file upload UI',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const single = dialog.locator('.mm-blocks-file-input').filter({hasText: 'Upload Single Document'});
        const multi = dialog.locator('.mm-blocks-file-input').filter({hasText: 'Upload Multiple Files'});
        await expect(single.getByRole('button', {name: 'Choose File'})).toBeVisible();
        await expect(multi.getByRole('button', {name: 'Choose Files'})).toBeVisible();
    });

    test('uploads required single and multiple files then submits', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'file_upload',
            buttonText: 'Open file upload submit',
            titleHint: 'mm_blocks file upload submit',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        const single = dialog.locator('.mm-blocks-file-input').filter({hasText: 'Upload Single Document'});
        const multi = dialog.locator('.mm-blocks-file-input').filter({hasText: 'Upload Multiple Files'});

        await single.locator('input[type="file"]').setInputFiles(fakeFile(`single-${pw.random.id()}.txt`, 'single'));
        await expect(single.getByTestId('file-preview-item')).toHaveCount(1);

        await multi
            .locator('input[type="file"]')
            .setInputFiles([
                fakeFile(`multi-a-${pw.random.id()}.txt`, 'a'),
                fakeFile(`multi-b-${pw.random.id()}.txt`, 'b'),
            ]);
        await expect(multi.getByTestId('file-preview-item')).toHaveCount(2);

        await dialog.getByRole('button', {name: 'Submit Files'}).click();
        await expect(dialog).toBeHidden();

        const ephemeral = await expectEphemeral(channelsPage.page, /Playwright mm_blocks dialog submit OK/);
        await expect(ephemeral).toContainText(/single_document=[a-z0-9]{26}/i);
        await expect(ephemeral).toContainText(/multiple_files=/);
    });

    test(
        'allow_multiple appends; single replaces on second selection',
        {tag: [...dialogTags]},
        async ({pw, request}) => {
            const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
                scenario: 'file_upload',
                buttonText: 'Open file upload replace',
                titleHint: 'mm_blocks file upload replace',
            });

            const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
            const single = dialog.locator('.mm-blocks-file-input').filter({hasText: 'Upload Single Document'});
            const multi = dialog.locator('.mm-blocks-file-input').filter({hasText: 'Upload Multiple Files'});

            await single.locator('input[type="file"]').setInputFiles(fakeFile('first.txt', '1'));
            await expect(single.getByTestId('file-preview-item')).toHaveCount(1);
            await single.locator('input[type="file"]').setInputFiles(fakeFile('second.txt', '2'));
            await expect(single.getByTestId('file-preview-item')).toHaveCount(1);
            await expect(single.getByTestId('file-preview-item')).toContainText('second.txt');

            await multi.locator('input[type="file"]').setInputFiles(fakeFile('m1.txt', '1'));
            await expect(multi.getByTestId('file-preview-item')).toHaveCount(1);
            await multi.locator('input[type="file"]').setInputFiles(fakeFile('m2.txt', '2'));
            await expect(multi.getByTestId('file-preview-item')).toHaveCount(2);
        },
    );

    test('required validation when submitting with no files', {tag: [...dialogTags]}, async ({pw, request}) => {
        const {channelsPage, marker, openButtonName} = await setupDialogOpenPost(pw, request, {
            scenario: 'file_upload',
            buttonText: 'Open file upload required',
            titleHint: 'mm_blocks file upload required',
        });

        const dialog = await openBlocksDialogFromPost(channelsPage, marker, openButtonName);
        await dialog.getByRole('button', {name: 'Submit Files'}).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('single_document-error')).toContainText(/required/i);
        await expect(dialog.getByTestId('multiple_files-error')).toContainText(/required/i);
    });
});
