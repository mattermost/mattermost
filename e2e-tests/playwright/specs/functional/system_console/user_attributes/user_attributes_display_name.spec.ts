// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {expect, test, testConfig} from '@mattermost/playwright-lib';
import type {PlaywrightExtended, SystemConsolePage} from '@mattermost/playwright-lib';

import {
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeValuesForUser,
} from '../../channels/custom_profile_attributes/helpers';

type FieldsMap = Record<string, UserPropertyField>;
type AdminUser = UserProfile & {password: string};

const IDENTIFIER_VALIDATION_MESSAGE =
    'Identifier must start with a letter or underscore and contain only letters, numbers, and underscores. Reserved CEL words are not allowed.';

interface TestContext {
    adminClient: Client4;
    adminUser: AdminUser;
    systemConsolePage: SystemConsolePage;
}

async function createAdminClient(): Promise<{adminClient: Client4; adminUser: AdminUser}> {
    const adminClient = new Client4();
    adminClient.setUrl(testConfig.baseURL);

    const loggedInUser = await adminClient.login(testConfig.adminUsername, testConfig.adminPassword);
    const adminUser = {
        ...loggedInUser,
        password: testConfig.adminPassword,
    } as AdminUser;

    return {adminClient, adminUser};
}

async function getFieldsMap(client: Client4): Promise<FieldsMap> {
    const fields = await client.getCustomProfileAttributeFields();
    return fields.reduce<FieldsMap>((acc, field) => {
        acc[field.id] = field;
        return acc;
    }, {});
}

async function cleanupAllFields(client: Client4) {
    const fieldsMap = await getFieldsMap(client);
    if (Object.keys(fieldsMap).length > 0) {
        await deleteCustomProfileAttributes(client, fieldsMap);
    }
}

async function setupTest(pw: PlaywrightExtended): Promise<TestContext> {
    const {adminClient, adminUser} = await createAdminClient();
    await cleanupAllFields(adminClient);

    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    return {adminClient, adminUser, systemConsolePage};
}

async function getTownSquareRoute(adminClient: Client4) {
    const teams = await adminClient.getMyTeams();
    expect(teams.length).toBeGreaterThan(0);

    const team = teams[0];
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    return {
        teamName: team.name,
        channelName: channel.name,
    };
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

async function seedLegacyField(adminClient: Client4, uid: number): Promise<UserPropertyField> {
    return adminClient.createCustomProfileAttributeField({
        name: `Legacy Field_${uid}`,
        type: 'text',
        // FIXTURE-ONLY: used to exercise the grandfathered invalid-name path.
        attrs: {sort_order: 99},
    } as any);
}

test.describe('System Console - User Attributes display names', () => {
    /**
     * @objective Verify that a CPA field's display_name is rendered as the user-facing
     * label in the user attributes table, the profile popover, account settings, and
     * the admin user detail page while the identifier remains unchanged in the API.
     */
    test('renders display_name across admin and self-service surfaces', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, adminUser, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        const uid = Date.now();
        const identifier = `department_${uid}`;
        const displayName = `Department ${uid}`;
        const attributeValue = 'Engineering';

        let createdField: UserPropertyField | undefined;

        try {
            // # Navigate to User Attributes and create a new field with a display name
            await sp.goto();

            // * Verify the table exposes both Name and Display Name columns
            await expect(sp.container.getByText('Name', {exact: true})).toBeVisible();
            await expect(sp.container.getByText('Display Name', {exact: true})).toBeVisible();

            await sp.addAttribute();
            await sp.nameInput(0).fill(identifier);
            await sp.nameInput(0).blur();
            await sp.displayNameInput(0).fill(displayName);
            await sp.displayNameInput(0).blur();

            await sp.saveAndWaitForSettled();

            const fields = await adminClient.getCustomProfileAttributeFields();
            createdField = fields.find((field) => field.name === identifier);

            expect(createdField).toBeDefined();
            expect(createdField?.attrs?.display_name).toBe(displayName);

            // # Set a value for sysadmin and open the self profile popover in Channels
            await setupCustomProfileAttributeValuesForUser(
                adminClient,
                [{name: identifier, value: attributeValue, type: 'text'}],
                {[createdField!.id]: createdField!},
                adminUser.id,
            );

            const {teamName, channelName} = await getTownSquareRoute(adminClient);
            const {channelsPage} = await pw.testBrowser.login(adminUser);

            await channelsPage.goto(teamName, channelName);
            await channelsPage.postMessage(`phase-5-display-name-${uid}`);

            const lastPost = await channelsPage.getLastPost();
            await channelsPage.openProfilePopover(lastPost);

            // * Verify the profile popover and account settings render display_name
            await expect(
                channelsPage.page.locator(`#user-popover__custom_attributes-title-${createdField!.id}`),
            ).toHaveText(displayName);

            await channelsPage.userProfilePopover.close();

            const profileModal = await channelsPage.openProfileModal();
            const section = profileModal.container.locator('.setting-list-item').filter({hasText: displayName});
            await expect(section).toBeVisible();

            const editButton = profileModal.container.locator(`#customAttribute_${createdField!.id}Edit`);
            await editButton.scrollIntoViewIfNeeded();
            await editButton.click();

            const settingsInput = profileModal.container.locator(`#customAttribute_${createdField!.id}`);
            await expect(settingsInput).toHaveAttribute('aria-label', displayName);
            await profileModal.closeModal();

            // # Open the admin user detail page for sysadmin
            await systemConsolePage.page.goto(`/admin_console/user_management/user/${adminUser.id}`);
            await systemConsolePage.users.userDetail.toBeVisible();

            // * Verify the admin user detail label also uses display_name
            await expect(
                systemConsolePage.page.getByTestId(`user-detail-custom-attribute-label-${createdField!.id}`),
            ).toContainText(displayName);
        } finally {
            if (createdField) {
                await adminClient.deleteCustomProfileAttributeField(createdField.id).catch(() => undefined);
            }
        }
    });

    /**
     * @objective Verify that invalid CPA identifiers are blocked client-side before
     * any create-field API request is issued, and that a valid identifier clears the
     * warning and can be saved successfully.
     */
    test('blocks invalid identifiers before API submission', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;
        const {page} = systemConsolePage;

        const apiPosts: string[] = [];
        let createdField: UserPropertyField | undefined;

        page.on('request', (request) => {
            if (request.method() === 'POST' && request.url().includes('/api/v4/custom_profile_attributes/fields')) {
                apiPosts.push(request.url());
            }
        });

        try {
            // # Add an attribute and exercise invalid identifier inputs in the table
            await sp.goto();
            await sp.addAttribute();

            const invalidIdentifiers = ['in', 'true', 'for'];
            for (const invalidIdentifier of invalidIdentifiers) {
                await sp.nameInput(0).fill(invalidIdentifier);
                await sp.nameInput(0).blur();

                // * Verify the warning appears and Save stays disabled before any POST
                await expect(sp.identifierValidationError()).toHaveText(IDENTIFIER_VALIDATION_MESSAGE);
                await expect(sp.saveButton).toBeDisabled();
            }

            expect(apiPosts).toHaveLength(0);

            // # Correct the identifier to a valid CEL-safe name and save it
            const validIdentifier = `my_field_${Date.now()}`;
            await sp.nameInput(0).fill(validIdentifier);
            await sp.nameInput(0).blur();

            // * Verify the warning clears and the field can be created successfully
            await expect(sp.identifierValidationError()).not.toBeVisible();
            await expect(sp.saveButton).toBeEnabled();

            await sp.saveAndWaitForSettled();

            const fields = await adminClient.getCustomProfileAttributeFields();
            createdField = fields.find((field) => field.name === validIdentifier);
            expect(createdField).toBeDefined();
        } finally {
            if (createdField) {
                await adminClient.deleteCustomProfileAttributeField(createdField.id).catch(() => undefined);
            }
        }
    });

    /**
     * @objective Verify that a legacy invalid-named field remains editable for
     * non-name attributes, but that renaming it still goes through the new
     * identifier validator and only persists once corrected to a valid name.
     */
    test('keeps legacy invalid identifiers grandfathered until renamed', {tag: '@user_attributes'}, async ({pw}) => {
        const {adminClient, systemConsolePage} = await setupTest(pw);
        const sp = systemConsolePage.systemProperties;

        const uid = Date.now();
        const originalIdentifier = `Legacy Field_${uid}`;
        const validIdentifier = `legacy_field_${uid}`;
        let legacyField: UserPropertyField | undefined;

        try {
            try {
                // # Seed a legacy invalid identifier to exercise grandfathered behavior
                legacyField = await seedLegacyField(adminClient, uid);
            } catch (error) {
                test.skip(true, `Legacy field seeding is unavailable in this environment: ${getErrorMessage(error)}`);
                return;
            }

            await sp.goto();

            const legacyNameInput = sp.nameInput(0);
            await expect(legacyNameInput).toHaveValue(originalIdentifier);

            // # Edit non-name attributes on the legacy field and save the changes
            await sp.displayNameInputNear(originalIdentifier).fill('Legacy Display');
            await sp.displayNameInputNear(originalIdentifier).blur();
            await expect(sp.saveButton).toBeEnabled();

            await sp.openDotMenu(legacyField!.id);
            await sp.setVisibility('Always hide');
            await sp.dismissMenu();
            await expect(sp.saveButton).toBeEnabled();

            await sp.saveAndWaitForSettled();

            // * Verify renaming the legacy field to a reserved word is blocked
            await legacyNameInput.fill('in');
            await legacyNameInput.blur();
            await expect(sp.identifierValidationError()).toHaveText(IDENTIFIER_VALIDATION_MESSAGE);
            await expect(sp.saveButton).toBeDisabled();

            // # Rename the legacy field to a valid identifier and persist the correction
            await legacyNameInput.fill(validIdentifier);
            await legacyNameInput.blur();
            await expect(sp.identifierValidationError()).not.toBeVisible();
            await expect(sp.saveButton).toBeEnabled();

            await sp.saveAndWaitForSettled();
            await sp.goto();
            await expect(sp.nameInputByValue(validIdentifier)).toBeVisible();

            const fields = await adminClient.getCustomProfileAttributeFields();
            const updatedField = fields.find((field) => field.id === legacyField!.id);

            // * Verify the corrected identifier and non-name edits were saved
            expect(updatedField?.name).toBe(validIdentifier);
            expect(updatedField?.attrs?.display_name).toBe('Legacy Display');
            expect(updatedField?.attrs?.visibility).toBe('hidden');
        } finally {
            if (legacyField) {
                await adminClient.deleteCustomProfileAttributeField(legacyField.id).catch(() => undefined);
            }
        }
    });
});
