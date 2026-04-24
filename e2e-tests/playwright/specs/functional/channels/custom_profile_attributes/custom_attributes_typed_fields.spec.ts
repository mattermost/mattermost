// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {verifyAttributeInPopover, TEST_PHONE, TEST_URL, TEST_MESSAGE} from './helpers';
import {setupCpaTestEnvironment, teardownCpaTestEnvironment, profilePopoverCustomAttributes} from './support';

const customAttributes = profilePopoverCustomAttributes;

let user: UserProfile;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;

test.beforeEach(async ({pw}) => {
    ({user, attributeFieldsMap, adminClient} = await setupCpaTestEnvironment(pw, customAttributes));
});

test.afterAll(async () => {
    await teardownCpaTestEnvironment(adminClient, attributeFieldsMap);
});

/**
 * Verify that phone and URL type custom profile attributes are displayed
 * correctly in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes including phone and URL types
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5778 Display phone and URL type custom profile attributes correctly @custom_profile_attributes', async ({
    pw,
}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 3. Open the profile popover for the other user
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify the Phone attribute is displayed correctly
    await verifyAttributeInPopover(channelsPage, 'Phone', TEST_PHONE);

    // * Verify the Website attribute is displayed correctly
    await verifyAttributeInPopover(channelsPage, 'Website', TEST_URL);
});

/**
 * Verify that phone and URL type custom profile attributes are clickable
 * in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes including phone and URL types
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5779 Verify phone and URL attributes are clickable in profile popover @custom_profile_attributes', async ({
    pw,
}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 3. Open the profile popover for the other user
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify the Phone attribute has a clickable link with tel: protocol
    const popover = channelsPage.userProfilePopover.container;
    const phoneLink = popover.getByText(TEST_PHONE, {exact: false});
    await expect(phoneLink).toHaveAttribute('href', new RegExp(`^tel:`));

    // * Verify the Website attribute has a clickable link with https: protocol
    const urlLink = popover.getByText(TEST_URL, {exact: false});
    await expect(urlLink).toHaveAttribute('href', new RegExp(`^https:`));
});
