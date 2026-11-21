// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';
import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import type {CpaFieldsMap, CustomProfileAttribute} from './helpers';
import {
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
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

// Field names are unique to this run. Specs that ran earlier on the same server
// can leave behind fields with the plain names (e.g. an admin-managed
// 'Department' from the ABAC specs); reusing one of those makes the user's own
// value write fail, and changing its visibility here would break those specs.
const fieldSuffix = getRandomId();
const FIELD_NAMES = {
    department: `Department_${fieldSuffix}`,
    location: `Location_${fieldSuffix}`,
    title: `Title_${fieldSuffix}`,
    phone: `Phone_${fieldSuffix}`,
    website: `Website_${fieldSuffix}`,
};

// Custom attribute definitions
const customAttributes: CustomProfileAttribute[] = [
    {
        name: FIELD_NAMES.department,
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: FIELD_NAMES.location,
        value: TEST_LOCATION,
        type: 'text',
    },
    {
        name: FIELD_NAMES.title,
        value: TEST_TITLE,
        type: 'text',
    },
    {
        name: FIELD_NAMES.phone,
        value: TEST_PHONE,
        type: 'text',
        attrs: {
            value_type: 'phone',
        },
    },
    {
        name: FIELD_NAMES.website,
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

// Only the first beforeEach creates the fields; later ones reuse them, so the
// IDs are collected across tests for afterAll to delete.
const createdFieldIds = new Set<string>();

test.beforeEach(async ({pw}) => {
    // Skip test if no license for "Custom Profile Attributes"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize with admin client
    ({team, user, adminClient, userClient} = await pw.initSetup({userOptions: {prefix: 'cpa-test-'}}));
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'test-channel',
        displayName: 'Test Channel',
    });
    testChannel = await adminClient.createChannel(channel);

    // Create another user to test profile popover
    otherUser = await pw.createNewUserProfile(adminClient, {prefix: 'cpa-other-'});
    await adminClient.addToTeam(team.id, otherUser.id);
    await adminClient.addToChannel(otherUser.id, testChannel.id);

    // Add the test user to the test channel
    await adminClient.addToChannel(user.id, testChannel.id);

    // Set up custom profile attribute fields
    const fieldsMap: CpaFieldsMap = await setupCustomProfileAttributeFields(adminClient, customAttributes);
    fieldsMap.ownedIds.forEach((id) => createdFieldIds.add(id));
    attributeFieldsMap = fieldsMap;

    // Login as the test user
    const {page} = await pw.testBrowser.login(user);

    // Set up initial values for custom profile attributes
    await setupCustomProfileAttributeValues(userClient, customAttributes, attributeFieldsMap);

    // The setup helpers log and swallow API errors, which otherwise surfaces
    // as a popover timeout far from the cause.
    expect(
        Object.values(attributeFieldsMap)
            .map((field) => field.name)
            .sort(),
    ).toEqual(Object.values(FIELD_NAMES).sort());
    const savedValues = await adminClient.getUserCustomProfileAttributesValues(user.id);
    expect(Object.keys(savedValues).sort()).toEqual(Object.keys(attributeFieldsMap).sort());

    // Visit the test channel
    await page.goto(`/${team.name}/channels/${testChannel.name}`);
});

test.afterAll(async () => {
    if (!adminClient) {
        return;
    }
    for (const id of createdFieldIds) {
        try {
            await adminClient.deleteCustomProfileAttributeField(id);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(`Failed to delete field ${id}:`, error);
        }
    }
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
    await channelsPage.page.locator('body').click({position: {x: 10, y: 10}});

    // 5. Update custom profile attributes
    const updatedAttributes: CustomProfileAttribute[] = [
        {
            name: FIELD_NAMES.department,
            value: TEST_UPDATED_DEPARTMENT,
            type: 'text',
        },
        {
            name: FIELD_NAMES.location,
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
    await verifyAttributeInPopover(channelsPage, FIELD_NAMES.title, TEST_TITLE);
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
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, FIELD_NAMES.department, 'hidden');

    // 2. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 3. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 4. Open the profile popover for the user's post
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

    // * Verify the Department attribute is not displayed
    await verifyAttributeNotInPopover(channelsPage, FIELD_NAMES.department);

    // * Verify other attributes are still displayed
    await verifyAttributeInPopover(channelsPage, FIELD_NAMES.location, TEST_LOCATION);
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
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, FIELD_NAMES.title, 'always');

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
        if (attribute.name === FIELD_NAMES.title) {
            // * Verify the Title attribute is displayed even though it has no value
            const popover = channelsPage.userProfilePopover.container;
            const nameElement = popover.getByText(FIELD_NAMES.title, {exact: false});
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
    await verifyAttributeInPopover(channelsPage, FIELD_NAMES.phone, TEST_PHONE);

    // * Verify the Website attribute is displayed correctly
    await verifyAttributeInPopover(channelsPage, FIELD_NAMES.website, TEST_URL);
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
    await expect(phoneLink).toHaveAttribute('href', new RegExp('^tel:'));

    // * Verify the Website attribute has a clickable link with https: protocol
    const urlLink = popover.getByText(TEST_URL, {exact: false});
    await expect(urlLink).toHaveAttribute('href', new RegExp('^https:'));
});
