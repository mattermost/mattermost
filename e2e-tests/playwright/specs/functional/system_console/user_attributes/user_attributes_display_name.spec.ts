// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {expect, test, testConfig} from '@mattermost/playwright-lib';
import type {PlaywrightExtended, SystemConsolePage} from '@mattermost/playwright-lib';

import {setupCustomProfileAttributeValuesForUser} from '../../channels/custom_profile_attributes/helpers';

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

async function setupTest(pw: PlaywrightExtended): Promise<TestContext> {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient, adminUser} = await createAdminClient();

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

            // * Verify the table exposes both Name and Display Name column headers
            await expect(sp.container.getByRole('columnheader', {name: 'Display Name', exact: true})).toBeVisible();
            await expect(sp.container.getByRole('columnheader', {name: 'Name', exact: true})).toBeVisible();

            // # Add a new row and fill identifier + display name
            await sp.addAttribute();
            await sp.lastNameInput().fill(identifier);
            await sp.lastNameInput().blur();
            await sp.lastDisplayNameInput().fill(displayName);
            await sp.lastDisplayNameInput().blur();

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
            const section = profileModal.container.locator('.section-min').filter({hasText: displayName});
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
        const validIdentifier = `my_field_${Date.now()}`;

        page.on('request', (request) => {
            if (request.method() === 'POST' && request.url().includes('/api/v4/custom_profile_attributes/fields')) {
                apiPosts.push(request.url());
            }
        });

        try {
            // # Add an attribute and exercise invalid identifier inputs in the table.
            // Use lastNameInput() — not positional nameInput(0) — so a leftover row from
            // a prior test attempt (or a concurrent UAAE/ABAC suite) cannot shift the
            // index and cause us to rename someone else's field instead of populating
            // the row we just added.
            await sp.goto();
            await sp.addAttribute();

            const invalidIdentifiers = ['in', 'true', 'for'];
            for (const invalidIdentifier of invalidIdentifiers) {
                await sp.lastNameInput().fill(invalidIdentifier);
                await sp.lastNameInput().blur();

                // * Verify the in-cell error icon and bottom banner are rendered,
                //   and Save stays disabled before any POST is issued.
                await expect(sp.identifierValidationError()).toBeVisible();
                await expect(sp.validationBannerByTitle(IDENTIFIER_VALIDATION_MESSAGE)).toBeVisible();
                await expect(sp.validationBannerByTitle(/not a valid identifier/)).toBeVisible();
                await expect(sp.saveButton).toBeDisabled();
            }

            expect(apiPosts).toHaveLength(0);

            // # Correct the identifier to a valid CEL-safe name and save it
            await sp.lastNameInput().fill(validIdentifier);
            await sp.lastNameInput().blur();

            // * Verify the warning clears and the field can be created successfully
            await expect(sp.identifierValidationError()).not.toBeVisible();
            await expect(sp.saveButton).toBeEnabled();

            await sp.saveAndWaitForSettled();

            const fields = await adminClient.getCustomProfileAttributeFields();
            const createdField = fields.find((field) => field.name === validIdentifier);
            expect(createdField).toBeDefined();
        } finally {
            // Look up the field by name rather than relying on a captured `createdField`
            // — the assertions above can throw before that variable is assigned, and we
            // still want to remove the server-side field so retries start from a clean slate.
            const fields = await adminClient.getCustomProfileAttributeFields().catch(() => []);
            const leftover = fields.find((field) => field.name === validIdentifier);
            if (leftover) {
                await adminClient.deleteCustomProfileAttributeField(leftover.id).catch(() => undefined);
            }
        }
    });
});
