// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {openDemoDialog} from './support';

test('should show validation errors when required fields are submitted empty', async ({pw}) => {
    // 1-5. Setup, login, navigate, send /dialog, confirm dialog opens with title "Test Title"
    const {dialog} = await openDemoDialog(pw, {expectedHeading: 'Test Title'});

    // 6. Clear the Number field and submit
    await dialog.getByTestId('somenumbernumber').clear();
    await dialog.getByRole('button', {name: 'Submit'}).click();

    // 7. Verify dialog stays open with validation errors
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Please fix all field errors', {exact: true})).toBeVisible();
    await expect(dialog.getByTestId('somenumber').getByText('This field is required.', {exact: true})).toBeVisible();
});

test('should show general error and keep dialog open on /dialog error submit', async ({pw}) => {
    // 1-5. Setup, login, navigate, send /dialog error, confirm dialog opens with title "Simple Dialog Test"
    const {dialog} = await openDemoDialog(pw, {command: '/dialog error', expectedHeading: 'Simple Dialog Test'});

    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Submit Test'})).toBeVisible();

    // 6. Fill the optional field and submit
    await dialog.getByPlaceholder('Enter some text (optional)...').fill('sample test input');
    await dialog.getByRole('button', {name: 'Submit Test'}).click();

    // 7. Verify general error appears and dialog stays open
    await expect(dialog.getByText('some error', {exact: true})).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('Enter some text (optional)...')).toHaveValue('sample test input');
});

test('should show general error on /dialog error-no-elements confirm', async ({pw}) => {
    // 1-5. Setup, login, navigate, send /dialog error-no-elements, confirm dialog opens with title "Sample Confirmation Dialog" and no form fields
    const {dialog} = await openDemoDialog(pw, {
        command: '/dialog error-no-elements',
        expectedHeading: 'Sample Confirmation Dialog',
    });

    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
    await expect(dialog.getByRole('textbox')).not.toBeVisible();

    // 6. Click Confirm
    await dialog.getByRole('button', {name: 'Confirm'}).click();

    // 7. Verify general error appears and dialog stays open
    await expect(dialog.getByText('some error', {exact: true})).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Confirm'})).toBeVisible();
});
