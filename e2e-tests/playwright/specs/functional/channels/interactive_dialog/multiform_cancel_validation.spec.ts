// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {openMultiform, setupMultiform} from './helpers';

/**
 * @objective Verify required-field validation keeps a user on the current multiform step.
 */
test('MM-T2550C validates the first multiform step', {tag: '@interactive_dialog'}, async ({pw, request}) => {
    const {channelsPage, dialog} = await setupMultiform(pw, request);

    // # Submit the first step without entering required values
    await openMultiform(channelsPage);
    await dialog.expectStepOne();
    await dialog.submitEmptyStepOne();

    // * Verify both required fields show errors and the first step remains open
    await dialog.expectRequiredFieldErrors(2);
    await dialog.expectStepOne();

    await dialog.close();
});

/**
 * @objective Verify a user can cancel the multiform from the first and second steps.
 */
test('MM-T2550D cancels the multiform at different steps', {tag: '@interactive_dialog'}, async ({pw, request}) => {
    const {channelsPage, dialog} = await setupMultiform(pw, request);

    // # Cancel from the first step
    await openMultiform(channelsPage);
    await dialog.expectStepOne();
    await dialog.cancel();

    // * Verify the first cancellation closes the form and posts a response
    await dialog.expectClosed();
    await channelsPage.centerView.waitUntilLastPostContains('Dialog cancelled');

    // # Reopen the form, advance, and cancel from the second step
    await openMultiform(channelsPage);
    await dialog.completeStepOne('Jane', 'jane@example.com');
    await dialog.expectStepTwo();
    const previousLastPostId = await channelsPage.centerView.getLastPostID();
    await dialog.cancel();

    // * Verify the second cancellation closes the form and posts a response
    await dialog.expectClosed();
    await expect
        .poll(() => channelsPage.centerView.getLastPostID(), {timeout: pw.duration.ten_sec})
        .not.toBe(previousLastPostId);
    await channelsPage.centerView.waitUntilLastPostContains('Dialog cancelled');
});

/**
 * @objective Verify each multiform step replaces the previous step's content.
 */
test('MM-T2550E maintains step-specific multiform content', {tag: '@interactive_dialog'}, async ({pw, request}) => {
    const {channelsPage, dialog} = await setupMultiform(pw, request);

    // # Open the form and advance from the personal-information step
    await openMultiform(channelsPage);
    await dialog.expectStepOne();
    await dialog.completeStepOne('Bob', 'bob@example.com');

    // * Verify the work-information step replaces the first step's fields
    await dialog.expectStepTwo();

    await dialog.close();
});
