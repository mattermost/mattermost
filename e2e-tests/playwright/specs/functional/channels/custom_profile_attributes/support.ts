// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {
    CustomProfileAttribute,
    TEST_DEPARTMENT,
    TEST_LOCATION,
    TEST_LOCATION_OPTIONS,
    TEST_PHONE,
    TEST_SKILLS_OPTIONS,
    TEST_TITLE,
    TEST_URL,
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

/**
 * Shared custom attribute definitions used by `user_settings_*` specs.
 * Includes `select` and `multiselect` attributes so tests can exercise
 * typed inputs beyond plain text.
 */
export const userSettingsCustomAttributes: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'Location',
        type: 'select',
        options: TEST_LOCATION_OPTIONS,
    },
    {
        name: 'Skills',
        type: 'multiselect',
        options: TEST_SKILLS_OPTIONS,
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

/**
 * Shared custom attribute definitions used by `custom_attributes_*` specs.
 * All fields are plain text; includes the `Title` attribute for popover
 * visibility checks.
 */
export const profilePopoverCustomAttributes: CustomProfileAttribute[] = [
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

/**
 * State returned from {@link setupCpaTestEnvironment} and used by
 * collocated specs. Module-level `let` bindings in each spec are assigned
 * from this shape.
 */
export type CpaTestState = {
    team: Team;
    user: UserProfile;
    otherUser: UserProfile;
    testChannel: Channel;
    attributeFieldsMap: Record<string, UserPropertyField>;
    adminClient: Client4;
    userClient: Client4;
};

/**
 * Performs the common `beforeEach` setup shared by all CPA specs in this
 * folder:
 * - ensures the license is present and skips otherwise
 * - initializes admin/user clients
 * - creates a test channel and a second user added to team + channel
 * - creates the custom profile attribute fields
 * - seeds the user's attribute values
 * - logs in the test user and navigates to the test channel
 *
 * @param pw - The playwright fixture `pw` from `@mattermost/playwright-lib`
 * @param attributes - Attribute definitions to create for the test
 */
export async function setupCpaTestEnvironment(pw: any, attributes: CustomProfileAttribute[]): Promise<CpaTestState> {
    // Skip test if no license for "Custom Profile Attributes"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize with admin client
    const {team, user, adminClient, userClient} = await pw.initSetup({userOptions: {prefix: 'cpa-test-'}});
    const channel = pw.random.channel({
        teamId: team.id,
        name: `test-channel`,
        displayName: `Test Channel`,
    });
    const testChannel = await adminClient.createChannel(channel);

    // Create another user to test profile popover
    const otherUser = await pw.createNewUserProfile(adminClient, {prefix: 'cpa-other-'});
    await adminClient.addToTeam(team.id, otherUser.id);
    await adminClient.addToChannel(otherUser.id, testChannel.id);

    // Add the test user to the test channel
    await adminClient.addToChannel(user.id, testChannel.id);

    // Set up custom profile attribute fields
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributes);

    // Login as the test user
    const {page} = await pw.testBrowser.login(user);

    // Set up initial values for custom profile attributes
    await setupCustomProfileAttributeValues(userClient, attributes, attributeFieldsMap);

    // Visit the test channel
    await page.goto(`/${team.name}/channels/${testChannel.name}`);

    return {team, user, otherUser, testChannel, attributeFieldsMap, adminClient, userClient};
}

/**
 * Tears down the custom profile attributes created for a spec. Intended
 * to run in `afterAll`.
 */
export async function teardownCpaTestEnvironment(
    adminClient: Client4,
    attributeFieldsMap: Record<string, UserPropertyField>,
): Promise<void> {
    await deleteCustomProfileAttributes(adminClient, attributeFieldsMap);
}
