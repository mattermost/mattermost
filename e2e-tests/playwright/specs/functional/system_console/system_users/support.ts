// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';
import {UserPropertyField} from '@mattermost/types/properties';

import {type PlaywrightExtended, type SystemConsolePage, expect} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
} from '../../channels/custom_profile_attributes/helpers';

/**
 * Shared test data for admin-editing Custom Profile Attribute specs.
 * Used by all user_attributes_admin_editing_* specs.
 */
export const testUserAttributes: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: 'Engineering',
        type: 'text',
        attrs: {
            visibility: 'when_set', // Ensure it's not synced
        },
    },
    {
        name: 'Work Email',
        value: 'work@company.com',
        type: 'text',
        attrs: {
            value_type: 'email',
            visibility: 'when_set', // Ensure it's not synced
        },
    },
    {
        name: 'Personal Website',
        value: 'https://johndoe.com',
        type: 'text',
        attrs: {
            value_type: 'url',
            visibility: 'when_set', // Ensure it's not synced
        },
    },
    {
        name: 'Location',
        type: 'select',
        attrs: {
            visibility: 'when_set', // Ensure it's not synced
        },
        options: [
            {name: 'Remote', color: '#00FFFF'},
            {name: 'Office', color: '#FF00FF'},
            {name: 'Hybrid', color: '#FFFF00'},
        ],
    },
    {
        name: 'Skills',
        type: 'multiselect',
        attrs: {
            visibility: 'when_set', // Ensure it's not synced
        },
        options: [
            {name: 'JavaScript', color: '#F0DB4F'},
            {name: 'React', color: '#61DAFB'},
            {name: 'Python', color: '#3776AB'},
            {name: 'Go', color: '#00ADD8'},
        ],
    },
];

/**
 * Set up a new random user, search for their email in the System Console users list,
 * and return accessors for the freshly-queried user and the system console page.
 * Shared by actions_activation_roles and actions_credentials_sessions specs.
 */
export async function setupAndGetRandomUser(pw: PlaywrightExtended) {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create a random user to edit
    const user = await adminClient.createUser(await pw.random.user(), '', '');
    const team = await adminClient.createTeam(await pw.random.team());
    await adminClient.addToTeam(team.id, user.id);

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Go to Users section
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // # Search for the user
    await systemConsolePage.users.searchUsers(user.email);

    // Wait for search results
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await expect(userRow.container.getByText(user.email)).toBeVisible();

    return {getUser: () => adminClient.getUser(user.id), systemConsolePage};
}

/**
 * Navigate to the user detail page for a given user.
 * Shared by user_detail_edit_auth_service and user_detail_edit_regular_user specs.
 */
export async function navigateToUserDetail(systemConsolePage: SystemConsolePage, user: UserProfile) {
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.users.searchUsers(user.email);
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await expect(userRow.container.getByText(user.email)).toBeVisible();
    await userRow.container.getByText(user.email).click();

    await systemConsolePage.users.userDetail.toBeVisible();
}

/**
 * Runtime context created by setupAdminEditingTest.
 * Shared by user_attributes_admin_editing_* specs.
 */
export interface AdminEditingTestContext {
    adminClient: Client4;
    systemConsolePage: SystemConsolePage;
    testUser: UserProfile;
    attributeFieldsMap: Record<string, UserPropertyField>;
}

/**
 * Ensure the license, seed custom profile attribute fields/values on a fresh target user,
 * log in as admin and navigate to the target user's detail page in the System Console.
 * Shared by user_attributes_admin_editing_* specs as the test.beforeEach body.
 */
export async function setupAdminEditingTest(pw: PlaywrightExtended): Promise<AdminEditingTestContext> {
    // Ensure license for Custom Profile Attributes functionality
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize with admin client
    const {team, adminUser, adminClient} = await pw.initSetup();

    // Create test user to edit
    const testUser = await pw.createNewUserProfile(adminClient, {prefix: 'admin-edit-target-'});
    await adminClient.addToTeam(team.id, testUser.id);

    // Set up custom user attribute fields
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, testUserAttributes);

    // Set initial custom attribute values for the test user
    await setupCustomProfileAttributeValuesForUser(adminClient, testUserAttributes, attributeFieldsMap, testUser.id);

    // Login as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // Navigate to system console users
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    // Search for target user and navigate to user detail page
    await systemConsolePage.users.searchUsers(testUser.email);
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await userRow.container.getByText(testUser.email).click();

    // Wait for user detail page to load
    await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);

    return {adminClient, systemConsolePage, testUser, attributeFieldsMap};
}

/**
 * Clean up custom user attribute fields created during setupAdminEditingTest.
 * Shared by user_attributes_admin_editing_* specs as the test.afterEach body.
 */
export async function cleanupAdminEditingTest(
    pw: PlaywrightExtended,
    attributeFieldsMap: Record<string, UserPropertyField>,
): Promise<void> {
    const {adminClient: cleanupClient} = await pw.getAdminClient();
    await deleteCustomProfileAttributes(cleanupClient, attributeFieldsMap);
}
