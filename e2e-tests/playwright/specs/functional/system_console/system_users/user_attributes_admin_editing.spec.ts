// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * LOCALIZATION NOTE:
 * This test suite uses test attributes (data-testid, id) for buttons to avoid
 * language dependencies, but still has some localization dependencies:
 * - Error message text assertions (e.g., 'Invalid email address')
 * - Field labels (e.g., 'Username', 'Email')
 * - Test data values (e.g., 'JavaScript', 'Python' option names)
 *
 * Currently runs in English-only (locale: 'en-US' in playwright.config.ts).
 * For multi-language support, these assertions would need refactoring.
 */

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, getRandomId, test, SystemConsolePage} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
    deleteCustomProfileAttributes,
} from '../../channels/custom_profile_attributes/helpers';

/** Per-run CPA names — avoids reusing global fields (e.g. "Old Name") from other suites. */
let cpaFieldNames: {
    department: string;
    workEmail: string;
    personalWebsite: string;
    location: string;
    skills: string;
};

let testUserAttributes: CustomProfileAttribute[];

let team: Team;
let adminUser: UserProfile;
let testUser: UserProfile;
let attributeFieldsMap: Record<string, UserPropertyField> = {};
let adminClient: Client4;
let systemConsolePage: SystemConsolePage;

test.describe('System Console - Admin User Profile Editing', () => {
    test.beforeEach(async ({pw}) => {
        // FIXME: CPA fields never render in admin console in CI.
        //
        // Root cause: system_user_detail.tsx gates ALL CPA rendering on:
        //   customProfileAttributeEnabled = isEnterpriseLicense(license) &&
        //                                   FeatureFlagCustomProfileAttributes === 'true'
        // If the server's FeatureFlagCustomProfileAttributes config key is not 'true'
        // (computed server-side, not patchable via patchConfig), componentDidMount skips
        // getCustomProfileAttributeFields() and the CPA section is never rendered.
        // Fields are created successfully via API, but the admin console shows nothing.
        //
        // This cannot be fixed in test code alone — the CI server environment needs
        // FeatureFlagCustomProfileAttributes='true'. Skipping until that is confirmed.
        //
        // Tracking: re-enable once CPA feature flag is active in CI.
        test.skip(true, 'FIXME: CPA fields not rendered — FeatureFlagCustomProfileAttributes not "true" in CI');

        // Ensure license for Custom Profile Attributes functionality
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        // Self-isolating setup — avoid pw.initSetup()'s destructive
        // adminClient.updateConfig() full-config reset which wipes CPA fields mid-run
        // for other concurrent tests in the same worker pool. Create a uniquely-named
        // team and user per test instead.
        const clientInfo = await pw.getAdminClient();
        if (!clientInfo.adminUser) {
            throw new Error('Admin user not found');
        }
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser;
        const suffix = getRandomId();
        cpaFieldNames = {
            department: `UAAE_Department_${suffix}`,
            workEmail: `UAAE_Work_Email_${suffix}`,
            personalWebsite: `UAAE_Personal_Website_${suffix}`,
            location: `UAAE_Location_${suffix}`,
            skills: `UAAE_Skills_${suffix}`,
        };
        testUserAttributes = [
            {
                name: cpaFieldNames.department,
                value: 'Engineering',
                type: 'text',
                attrs: {
                    visibility: 'when_set',
                },
            },
            {
                name: cpaFieldNames.workEmail,
                value: 'work@company.com',
                type: 'text',
                attrs: {
                    value_type: 'email',
                    visibility: 'when_set',
                },
            },
            {
                name: cpaFieldNames.personalWebsite,
                value: 'https://johndoe.com',
                type: 'text',
                attrs: {
                    value_type: 'url',
                    visibility: 'when_set',
                },
            },
            {
                name: cpaFieldNames.location,
                type: 'select',
                attrs: {
                    visibility: 'when_set',
                },
                options: [
                    {name: 'Remote', color: '#00FFFF'},
                    {name: 'Office', color: '#FF00FF'},
                    {name: 'Hybrid', color: '#FFFF00'},
                ],
            },
            {
                name: cpaFieldNames.skills,
                type: 'multiselect',
                attrs: {
                    visibility: 'when_set',
                },
                options: [
                    {name: 'JavaScript', color: '#F0DB4F'},
                    {name: 'React', color: '#61DAFB'},
                    {name: 'Python', color: '#3776AB'},
                    {name: 'Go', color: '#00ADD8'},
                ],
            },
        ];
        team = await adminClient.createTeam({
            name: `uaae-${suffix}`,
            display_name: `UAAE ${suffix}`,
            type: 'O',
        } as any);
        await adminClient.addToTeam(team.id, adminUser.id);

        // Create test user to edit
        testUser = await pw.createNewUserProfile(adminClient, {prefix: 'admin-edit-target-'});
        await adminClient.addToTeam(team.id, testUser.id);

        // Pre-cleanup: delete any stale UAAE-prefixed fields from previous runs that
        // may have leaked past afterEach (e.g. from a crashed test). The server enforces
        // a 20-field limit; stale fields silently block creation of our fresh ones.
        // The 'UAAE_' prefix is unique to this suite so deleting them is safe even when
        // other test suites run concurrently on the same server.
        try {
            const existingFields = await adminClient.getCustomProfileAttributeFields();
            const staleUaaeFields = existingFields.filter((f) => f.name.startsWith('UAAE_'));
            if (staleUaaeFields.length > 0) {
                const staleMap: Record<string, UserPropertyField> = {};
                for (const f of staleUaaeFields) {
                    staleMap[f.id] = f;
                }
                await deleteCustomProfileAttributes(adminClient, staleMap);
            }
        } catch {
            // Best-effort — if cleanup fails, proceed and let the real error surface below.
        }

        // Set up custom user attribute fields
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, testUserAttributes);

        // Fail fast if any expected field was not created — setupCustomProfileAttributeFields
        // silently swallows 422 errors (e.g. 20-field server limit), leaving the map incomplete.
        // Without this check the test would only time out 30 s later at the UI assertion with a
        // misleading "element not found" error.
        const missingFields = testUserAttributes
            .map((a) => a.name)
            .filter((name) => !Object.values(attributeFieldsMap).some((f) => f.name === name));
        if (missingFields.length > 0) {
            const all = await adminClient.getCustomProfileAttributeFields().catch(() => []);
            throw new Error(
                `CPA field creation failed for: [${missingFields.join(', ')}]. ` +
                    `Server currently has ${all.length} fields: [${all.map((f) => f.name).join(', ')}]. ` +
                    `Possible 20-field limit breach — check for leaked fields from other test suites.`,
            );
        }

        // Fields reused by name can still carry access_mode=source_only from another suite; the admin
        // user detail page hides those (system_user_detail.tsx) so no CPA labels ever appear.
        const refreshedFields = await adminClient.getCustomProfileAttributeFields();
        for (const attr of testUserAttributes) {
            const field = refreshedFields.find((f) => f.name === attr.name);
            if (field?.attrs?.access_mode === 'source_only') {
                await adminClient.patchCustomProfileAttributeField(field.id, {
                    attrs: {...field.attrs, access_mode: ''},
                } as any);
            }
        }

        // Set initial custom attribute values for the test user
        await setupCustomProfileAttributeValuesForUser(
            adminClient,
            testUserAttributes,
            attributeFieldsMap,
            testUser.id,
        );

        // Login as admin
        ({systemConsolePage} = await pw.testBrowser.login(adminUser));

        // Navigate to system console users
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.users.click();
        await systemConsolePage.users.toBeVisible();

        // Search for target user and navigate to user detail page
        await systemConsolePage.users.searchUsers(testUser.email);
        const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
        await userRow.container.getByText(testUser.email).click();

        // Wait for the initial navigation to the user detail page.
        await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);

        // Reload the page to clear the Redux CPA field cache.
        //
        // system_user_detail.tsx componentDidMount only calls getCustomProfileAttributeFields()
        // when customProfileAttributeFields.length === 0 (line 226). Playwright reuses the same
        // browser context across beforeEach runs, so the in-memory Redux store from the previous
        // test still holds the OLD UAAE field definitions (e.g. UAAE_Department_fe45b8d). Even
        // though afterEach deleted those fields from the server, Redux never clears them. On the
        // next beforeEach the condition is false, the fetch is skipped, the stale labels render,
        // and span:text-is("UAAE_Department_<new-suffix>") never matches — causing a 30 s timeout.
        //
        // A full page reload tears down the React/Redux state so componentDidMount starts with an
        // empty store and unconditionally fetches the current (freshly created) fields.
        await systemConsolePage.page.reload();
        await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);
        await systemConsolePage.users.userDetail.userCard.container.waitFor({state: 'visible'});
        const {userCard} = systemConsolePage.users.userDetail;
        await expect(userCard.getFieldInputByExactLabel(cpaFieldNames.department)).toBeVisible({timeout: 30_000});
        await expect(userCard.getFieldInputByExactLabel(cpaFieldNames.workEmail)).toBeVisible({timeout: 30_000});
    });

    test.afterEach(async ({pw}) => {
        // When beforeEach was skipped (e.g. test.skip()), attributeFieldsMap stays
        // empty and there is nothing server-side to clean up.
        if (Object.keys(attributeFieldsMap).length === 0) {
            return;
        }
        // Clean up custom user attribute fields
        const {adminClient: cleanupClient} = await pw.getAdminClient();
        await deleteCustomProfileAttributes(cleanupClient, attributeFieldsMap);
    });

    test('MM-65126 Should edit custom user attributes from system console', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find and edit Department field (custom text attribute)
        const departmentInput = userCard.getFieldInputByExactLabel(cpaFieldNames.department);
        await departmentInput.clear();
        await departmentInput.fill('Marketing');

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success (no error message and field retains new value)
        await expect(userDetail.errorMessage).not.toBeVisible();
        await expect(departmentInput).toHaveValue('Marketing');

        // * Verify Save button becomes disabled after successful save
        await userDetail.waitForSaveComplete();
    });

    test('Should display user attributes in two-column layout', async () => {
        const {userCard} = systemConsolePage.users.userDetail;

        // * Verify two-column layout exists
        await expect(userCard.twoColumnLayout).toBeVisible();

        // * Verify system fields are present
        await expect(userCard.usernameInput).toBeVisible();
        await expect(userCard.emailInput).toBeVisible();
        await expect(userCard.authenticationMethod).toBeVisible();

        // * Verify custom user attributes are present
        for (const field of testUserAttributes) {
            await expect(
                systemConsolePage.page.locator('label').filter({hasText: new RegExp(field.name)}),
            ).toBeVisible();
        }

        // * Verify we have input fields (at least 4-5 total)
        const inputElements = systemConsolePage.page.locator('input, select');
        const inputCount = await inputElements.count();
        expect(inputCount).toBeGreaterThan(4);

        // * Verify fields are arranged in rows with two columns
        const rowCount = await userCard.fieldRows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test('Should edit system email attribute and save', async () => {
        const {userDetail} = systemConsolePage.users;
        const {emailInput} = userDetail.userCard;

        // # Enter new valid email
        const newEmail = `updated-${testUser.email}`;
        await emailInput.clear();
        await emailInput.fill(newEmail);

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success
        await expect(userDetail.errorMessage).not.toBeVisible();
        await expect(emailInput).toHaveValue(newEmail);
        await userDetail.waitForSaveComplete();
    });

    test('Should edit custom select attribute and save', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find Location select field
        const locationSelect = userCard.getSelectByExactLabel(cpaFieldNames.location);

        // # Get the first available option (since we can't predict the option value/ID)
        const firstOption = await locationSelect.locator('option').nth(1); // Skip the default "Select an option"
        const firstOptionValue = await firstOption.getAttribute('value');
        await locationSelect.selectOption(firstOptionValue || '');

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success and persistence
        await expect(userDetail.errorMessage).not.toBeVisible();
        // Don't check exact value since it's a generated ID, just verify it's not empty
        const selectedValue = await locationSelect.inputValue();
        expect(selectedValue).toBeTruthy();
        await userDetail.waitForSaveComplete();
    });

    test('Should display custom multiselect attribute and save form', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // * Verify Skills multiselect component is displayed
        const skillsColumn = userCard.getCpaMultiselectContainer(cpaFieldNames.skills);
        await expect(skillsColumn).toBeVisible();

        // # Make a change to a different field to trigger save state
        const departmentInput = userCard.getFieldInputByExactLabel(cpaFieldNames.department);
        await departmentInput.fill('Engineering Updated');

        // # Verify save button becomes enabled
        await expect(userDetail.saveButton).toBeEnabled();

        // # Save the form and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify success (no error message)
        await expect(userDetail.errorMessage).not.toBeVisible();

        // * Verify save completed
        await userDetail.waitForSaveComplete();

        // * Verify the change persisted
        await expect(departmentInput).toHaveValue('Engineering Updated');
    });

    test('Should validate invalid email and show error with cancel option', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find CPA email field (Work Email)
        const workEmailInput = userCard.getFieldInputByExactLabel(cpaFieldNames.workEmail);
        await workEmailInput.scrollIntoViewIfNeeded();
        const originalEmail = await workEmailInput.inputValue();

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email');

        // * Verify inline validation error appears (async client-side validation in CI)
        const fieldError = userCard.getFieldError(cpaFieldNames.workEmail);
        await expect(fieldError).toBeVisible({timeout: 30000});
        await expect(fieldError).toContainText('Invalid email address');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is visible and enabled
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Test the cancel functionality
        await userDetail.cancel();

        // * Verify email reverts to original value
        await expect(workEmailInput).toHaveValue(originalEmail);

        // * Verify validation error disappears
        await expect(fieldError).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();

        // * Verify Save button remains disabled (no unsaved changes)
        await expect(userDetail.saveButton).toBeDisabled();
    });

    test('Should validate invalid URL and show error with cancel option', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find custom URL field (Personal Website)
        const urlInput = userCard.getFieldInputByExactLabel(cpaFieldNames.personalWebsite);
        const originalUrl = await urlInput.inputValue();

        // # Enter invalid URL (specifically the one mentioned: "<%>")
        await urlInput.clear();
        await urlInput.fill('<%>');

        // * Verify inline validation error appears
        const fieldError = userCard.getFieldError(cpaFieldNames.personalWebsite);
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText('Invalid URL');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is visible
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Test cancel functionality
        await userDetail.cancel();

        // * Verify URL reverts to original value
        await expect(urlInput).toHaveValue(originalUrl);

        // * Verify validation error disappears
        await expect(fieldError).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();
    });

    test('Should validate invalid email in custom email attribute', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Find custom email field (Work Email)
        const workEmailInput = userCard.getFieldInputByExactLabel(cpaFieldNames.workEmail);

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email-either');

        // * Verify inline validation error appears
        const fieldError = userCard.getFieldError(cpaFieldNames.workEmail);
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText('Invalid email address');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is available
        await expect(userDetail.cancelButton).toBeVisible();
    });

    test('Should show save/cancel buttons when changes are made', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // * Initially, Save should be disabled and Cancel should not be visible
        await expect(userDetail.saveButton).toBeDisabled();
        await expect(userDetail.cancelButton).not.toBeVisible();

        // # Make a change to trigger save needed state
        const departmentInput = userCard.getFieldInputByExactLabel(cpaFieldNames.department);
        const originalValue = await departmentInput.inputValue();
        await departmentInput.clear();
        await departmentInput.fill('Changed Value');

        // * Verify Save button becomes enabled and Cancel button appears
        await expect(userDetail.saveButton).toBeEnabled();
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Click Cancel
        await userDetail.cancel();

        // * Verify changes are reverted
        await expect(departmentInput).toHaveValue(originalValue);

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();

        // * Verify Save button is disabled
        await expect(userDetail.saveButton).toBeDisabled();
    });

    test('Should save all user attribute changes atomically', async () => {
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;

        // # Make changes to both system and custom attributes
        const newEmail = `atomic-test-${testUser.email}`;
        await userCard.emailInput.clear();
        await userCard.emailInput.fill(newEmail);

        const departmentInput = userCard.getFieldInputByExactLabel(cpaFieldNames.department);
        await departmentInput.clear();
        await departmentInput.fill('Sales');

        // # Click Save button and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * Verify both changes were saved successfully
        await expect(userDetail.errorMessage).not.toBeVisible();
        await expect(userCard.emailInput).toHaveValue(newEmail);
        await expect(departmentInput).toHaveValue('Sales');
        await userDetail.waitForSaveComplete();
    });
});
