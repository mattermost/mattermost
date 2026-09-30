// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {openMultiform, setupMultiform} from './helpers';

/**
 * @objective Verify the first multiform step shows its title, fields, and action.
 */
test('MM-T2550A shows the initial multiform step', {tag: '@interactive_dialog'}, async ({pw, request}) => {
    const {channelsPage, dialog} = await setupMultiform(pw, request);

    // # Execute the custom command that opens the multiform
    await openMultiform(channelsPage);

    // * Verify the first step has the expected controls
    await dialog.expectStepOne();

    // # Close the form
    await dialog.close();
    await dialog.expectClosed();
});

/**
 * @objective Verify a user can complete all three steps of a multiform workflow.
 */
test('MM-T2550B completes the multiform workflow', {tag: '@interactive_dialog'}, async ({pw, request}) => {
    const {channelsPage, dialog} = await setupMultiform(pw, request);

    // # Complete each step of the multiform
    await openMultiform(channelsPage);
    await dialog.expectStepOne();
    await dialog.completeStepOne('John', 'john.doe@example.com');
    await dialog.expectStepTwo();
    await dialog.completeStepTwo();
    await dialog.expectStepThree();
    await dialog.completeStepThree('Multiform test completed successfully');

    // * Verify the form closes and the integration posts its completion response
    await dialog.expectClosed();
    await channelsPage.centerView.waitUntilLastPostContains('Multistep completed successfully');
    await channelsPage.centerView.waitUntilLastPostContains('Final step values');
});
