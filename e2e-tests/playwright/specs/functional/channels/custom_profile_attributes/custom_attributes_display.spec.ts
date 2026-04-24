// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {test} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeValues,
    verifyAttributeInPopover,
    verifyAttributeNotInPopover,
    TEST_UPDATED_DEPARTMENT,
    TEST_UPDATED_LOCATION,
    TEST_TITLE,
    TEST_MESSAGE,
} from './helpers';
import {setupCpaTestEnvironment, teardownCpaTestEnvironment, profilePopoverCustomAttributes} from './support';

const customAttributes = profilePopoverCustomAttributes;

let user: UserProfile;
let otherUser: UserProfile;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;
let userClient: Client4;

test.beforeEach(async ({pw}) => {
    ({user, otherUser, attributeFieldsMap, adminClient, userClient} = await setupCpaTestEnvironment(
        pw,
        customAttributes,
    ));
});

test.afterAll(async () => {
    await teardownCpaTestEnvironment(adminClient, attributeFieldsMap);
});

/**
 * Verify that custom profile attributes are displayed correctly in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has values set for custom profile attributes
 * 4. User is a member of a channel
 */
test('MM-T5773 Display custom profile attributes in profile popover @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 3. Open the profile popover for the user's post
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify each custom attribute is displayed correctly
    for (const attribute of customAttributes) {
        if (attribute.value) {
            await verifyAttributeInPopover(channelsPage, attribute.name, attribute.value);
        }
    }
});

/**
 * Verify that custom profile attributes are not displayed in the profile popover
 * if the user has no values set.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has no values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5774 Do not display custom profile attributes if none exist @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the other user
    const {channelsPage} = await pw.testBrowser.login(otherUser);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 3. Open the profile popover for the user's post
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify custom attributes are not displayed
    for (const attribute of customAttributes) {
        await verifyAttributeNotInPopover(channelsPage, attribute.name);
    }
});

/**
 * Verify that custom profile attributes are updated correctly when changed
 * and the changes are reflected in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5775 Update custom profile attributes when changed @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 3. Open the profile popover for the user's post
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify each custom attribute is displayed correctly
    for (const attribute of customAttributes) {
        if (attribute.value) {
            await verifyAttributeInPopover(channelsPage, attribute.name, attribute.value);
        }
    }

    // 4. Close the profile popover
    await channelsPage.page.click('body', {position: {x: 10, y: 10}});

    // 5. Update custom profile attributes
    const updatedAttributes: CustomProfileAttribute[] = [
        {
            name: 'Department',
            value: TEST_UPDATED_DEPARTMENT,
            type: 'text',
        },
        {
            name: 'Location',
            value: TEST_UPDATED_LOCATION,
            type: 'text',
        },
    ];
    await setupCustomProfileAttributeValues(userClient, updatedAttributes, attributeFieldsMap);

    // 6. Open the profile popover again
    await channelsPage.openProfilePopover(lastPost);

    // * Verify updated attributes are displayed correctly
    for (const attribute of updatedAttributes) {
        if (attribute.value) {
            await verifyAttributeInPopover(channelsPage, attribute.name, attribute.value);
        }
    }

    // * Verify non-updated attribute is still displayed correctly
    await verifyAttributeInPopover(channelsPage, 'Title', TEST_TITLE);
});
