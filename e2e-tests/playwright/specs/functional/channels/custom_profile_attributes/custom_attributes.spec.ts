// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
    deleteCustomProfileAttributes,
    verifyAttributeInPopover,
    verifyAttributeNotInPopover,
    updateCustomProfileAttributeVisibility,
    TEST_PHONE,
    TEST_URL,
    TEST_DEPARTMENT,
    TEST_LOCATION,
    TEST_UPDATED_DEPARTMENT,
    TEST_UPDATED_LOCATION,
    TEST_TITLE,
    TEST_MESSAGE,
} from './helpers';

// Custom attribute definitions
const customAttributes: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'Location',
        value: TEST_LOCATION,
        type: 'text',
    },
    {
        name: 'Title',
        value: TEST_TITLE,
        type: 'text',
    },
    {
        name: 'Phone',
        value: TEST_PHONE,
        type: 'text',
        attrs: {
            value_type: 'phone',
        },
    },
    {
        name: 'Website',
        value: TEST_URL,
        type: 'text',
        attrs: {
            value_type: 'url',
        },
    },
];

let team: Team;
let user: UserProfile;
let otherUser: UserProfile;
let testChannel: Channel;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;
let userClient: Client4;

test.beforeEach(async ({pw}) => {
    // Skip test if no license for "Custom Profile Attributes"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize with admin client
    ({team, user, adminClient, userClient} = await pw.initSetup({userPrefix: 'cpa-test-'}));
    const channel = pw.random.channel({
        teamId: team.id,
        name: `test-channel`,
        displayName: `Test Channel`,
    });
    testChannel = await adminClient.createChannel(channel);

    // Create another user to test profile popover
    otherUser = await pw.createNewUserProfile(adminClient, 'cpa-other-');
    await adminClient.addToTeam(team.id, otherUser.id);
    await adminClient.addToChannel(otherUser.id, testChannel.id);

    // Add the test user to the test channel
    await adminClient.addToChannel(user.id, testChannel.id);

    // Set up custom profile attribute fields
    attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, customAttributes);

    // Login as the test user
    const {page} = await pw.testBrowser.login(user);

    // Set up initial values for custom profile attributes
    await setupCustomProfileAttributeValues(userClient, customAttributes, attributeFieldsMap);

    // Visit the test channel
    await page.goto(`/${team.name}/channels/${testChannel.name}`);
});

test.afterAll(async () => {
    // Clean up by deleting custom profile attributes
    await deleteCustomProfileAttributes(adminClient, attributeFieldsMap);
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
