// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    verifyAttributeInPopover,
    verifyAttributeNotInPopover,
    updateCustomProfileAttributeVisibility,
    TEST_LOCATION,
    TEST_MESSAGE,
} from './helpers';
import {setupCpaTestEnvironment, teardownCpaTestEnvironment, profilePopoverCustomAttributes} from './support';

const customAttributes = profilePopoverCustomAttributes;

let user: UserProfile;
let otherUser: UserProfile;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;

test.beforeEach(async ({pw}) => {
    ({user, otherUser, attributeFieldsMap, adminClient} = await setupCpaTestEnvironment(pw, customAttributes));
});

test.afterAll(async () => {
    await teardownCpaTestEnvironment(adminClient, attributeFieldsMap);
});

/**
 * Verify that custom profile attributes with visibility set to hidden
 * are not displayed in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5776 Hide custom profile attributes when visibility is set to hidden @custom_profile_attributes', async ({
    pw,
}) => {
    // 1. Update the visibility of the Department attribute to hidden
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, 'Department', 'hidden');

    // 2. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 3. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 4. Open the profile popover for the user's post
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify the Department attribute is not displayed
    await verifyAttributeNotInPopover(channelsPage, 'Department');

    // * Verify other attributes are still displayed
    await verifyAttributeInPopover(channelsPage, 'Location', TEST_LOCATION);
});

/**
 * Verify that custom profile attributes with visibility set to always
 * are displayed in the profile popover even if they have no value.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5777 Always display custom profile attributes with visibility set to always @custom_profile_attributes', async ({
    pw,
}) => {
    // 1. Update the visibility of the Title attribute to always
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, 'Title', 'always');

    // 2. Login as the other user
    const {channelsPage} = await pw.testBrowser.login(otherUser);
    await channelsPage.goto();

    // 3. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 4. Open the profile popover for the user's post
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify custom attributes are displayed correctly
    for (const attribute of customAttributes) {
        if (attribute.name === 'Title') {
            // * Verify the Title attribute is displayed even though it has no value
            const popover = channelsPage.userProfilePopover.container;
            const nameElement = popover.getByText('Title', {exact: false});
            await expect(nameElement).toBeVisible();
        } else {
            await verifyAttributeNotInPopover(channelsPage, attribute.name);
        }
    }
});
