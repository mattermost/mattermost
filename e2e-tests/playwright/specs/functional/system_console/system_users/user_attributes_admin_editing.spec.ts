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

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    expect,
    getRandomId,
    searchSystemUsers,
    systemConsolePath,
    test,
    type App,
    duration,
    Msg,
    comboboxChips,
    removeComboboxChip,
} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../channels/custom_profile_attributes/helpers';
import {
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
    deleteCustomProfileAttributes,
} from '../../channels/custom_profile_attributes/helpers';
import {optionId} from '../../channels/channel_attributes/helpers';

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
let app: App | undefined;

/** A created attribute field by its name. */
function field(name: string): UserPropertyField {
    const found = Object.values(attributeFieldsMap).find((f) => !(f instanceof Set) && f.name === name);
    if (!found) {
        throw new Error(`No attribute field named ${name}`);
    }
    return found;
}

/** The logged-in admin's app; set by `beforeEach`. */
function adminApp(): App {
    if (!app) {
        throw new Error('The admin is not logged in');
    }
    return app;
}

/** A text attribute's input on the user detail page. */
function attributeInput(name: string) {
    return adminApp().admin.user.attribute(field(name)).valueInputTextbox.locator;
}

test.describe('System Console - Admin User Profile Editing', () => {
    test.beforeEach(async ({pw}) => {
        // Ensure license for Custom Profile Attributes functionality.
        // isEnterpriseLicense() in the webapp only returns true for SKUs: enterprise, E20,
        // advanced, entry. If the CI license is a lower tier, CPA rendering is gated off.
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
                    display_name: 'Work Email',
                },
            },
            {
                name: cpaFieldNames.personalWebsite,
                value: 'https://johndoe.com',
                type: 'text',
                attrs: {
                    value_type: 'url',
                    visibility: 'when_set',
                    display_name: 'Personal Website',
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

        // Pre-cleanup: delete stale UAAE-prefixed fields from previous runs of
        // this suite. The prefix is unique to these tests; do not delete other
        // suites' fields. attribute_order_and_popover now cleans up its own.
        const existingFields = await adminClient.getCustomProfileAttributeFields();
        const staleUaaeFields = existingFields.filter((f) => f.name.startsWith('UAAE_'));
        if (staleUaaeFields.length > 0) {
            const staleMap: Record<string, UserPropertyField> = {};
            for (const f of staleUaaeFields) {
                staleMap[f.id] = f;
            }
            await deleteCustomProfileAttributes(adminClient, staleMap);
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
            const all = await adminClient.getCustomProfileAttributeFields();
            throw new Error(
                `CPA field creation failed for: [${missingFields.join(', ')}]. ` +
                    `Server currently has ${all.length} fields: [${all.map((f) => f.name).join(', ')}]. ` +
                    'Possible 20-field limit breach — check for leaked fields from other test suites.',
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
        ({app} = await pw.testBrowser.login(adminUser));

        // Navigate to system console users
        await app.page.goto('/admin_console/user_management/users');
        await expect(app.admin.users.search.container).toBeVisible();

        // Search for target user and navigate to user detail page
        await searchSystemUsers(app, testUser.email, testUser);
        await app.admin.users.table.row(testUser.id).cell('emailColumn').click();

        // Wait for the initial navigation to the user detail page.
        await expect(app.page).toHavePath(systemConsolePath(`user_management/user/${testUser.id}`));

        // Freeze the fields API so concurrent shard activity (field creates/deletes) cannot
        // trigger a WebSocket-driven re-fetch that wipes the CPA section from Redux mid-test.
        const frozenFields = Object.values(attributeFieldsMap);
        await app.page.route('**/api/v4/custom_profile_attributes/fields', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(frozenFields),
            });
        });

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
        await app.page.reload();
        await expect(app.page).toHavePath(systemConsolePath(`user_management/user/${testUser.id}`));
        await expect(app.admin.user.emailTextbox).toBeVisible();
        await expect(attributeInput(cpaFieldNames.department)).toBeVisible({timeout: duration.half_min});
        await expect(attributeInput(cpaFieldNames.workEmail)).toBeVisible({timeout: duration.half_min});

        // Remove the intercept now that field visibility is confirmed.
        // Keeping it active through the test body would intercept the save API call
        // (which also hits the /fields endpoint during submit), causing "Failed to update user".
        // Validation tests restore their own intercept; afterEach removes it again.
        await app.page.unroute('**/api/v4/custom_profile_attributes/fields');
    });

    test.afterEach(async ({pw}) => {
        // When beforeEach was skipped (e.g. test.skip()), attributeFieldsMap stays
        // empty and there is nothing server-side to clean up.
        if (Object.keys(attributeFieldsMap).length === 0) {
            return;
        }
        // Remove the intercept a validation test re-applied, or the one beforeEach never
        // got to remove.
        await app?.page.unroute('**/api/v4/custom_profile_attributes/fields');
        // Clean up custom user attribute fields
        const {adminClient: cleanupClient} = await pw.getAdminClient();
        await deleteCustomProfileAttributes(cleanupClient, attributeFieldsMap);
    });

    test('MM-65126 Should edit custom user attributes from system console', async () => {
        const userDetail = adminApp().admin.user;

        // # Find and edit Department field (custom text attribute)
        const departmentInput = attributeInput(cpaFieldNames.department);
        await departmentInput.clear();
        await departmentInput.fill('Marketing');

        // # Click Save button and confirm
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * Verify success (no error message and field retains new value)
        await expect(userDetail.saveErrorText).not.toBeVisible();
        await expect(departmentInput).toHaveValue('Marketing');

        // * Verify Save button becomes disabled after successful save
        await expect(userDetail.saveButton).toBeSaved();
    });

    test('Should display user attributes in two-column layout', async () => {
        const userDetail = adminApp().admin.user;

        // * Verify two-column layout exists
        await expect(userDetail.fields).toBeVisible();

        // * Verify system fields are present
        await expect(userDetail.usernameTextbox).toBeVisible();
        await expect(userDetail.emailTextbox).toBeVisible();
        await expect(userDetail.authMethodText).toBeVisible();

        // * Verify custom user attributes are present
        for (const attribute of testUserAttributes) {
            const label = attribute.attrs?.display_name || attribute.name;
            await expect(userDetail.attribute(field(attribute.name))).toContainText(label);
        }

        // * Verify fields are arranged in rows: two to a row, so the five custom attributes fill three
        await expect(userDetail.standardFields.row(0)).toBeVisible();
        await expect(userDetail.customFields.row(2)).toBeVisible();
    });

    test('Should edit system email attribute and save', async () => {
        const userDetail = adminApp().admin.user;
        const emailInput = userDetail.emailTextbox.locator;

        // # Enter new valid email
        const newEmail = `updated-${testUser.email}`;
        await emailInput.clear();
        await emailInput.fill(newEmail);

        // # Click Save button and confirm
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * Verify success
        await expect(userDetail.saveErrorText).not.toBeVisible();
        await expect(emailInput).toHaveValue(newEmail);
        await expect(userDetail.saveButton).toBeSaved();
    });

    test('Should edit custom select attribute and save', async () => {
        const userDetail = adminApp().admin.user;
        const locationField = field(cpaFieldNames.location);
        const location = userDetail.attribute(locationField);
        const combobox = location.valueChoiceCombobox.locator;

        // * Verify the Location combobox starts empty with its placeholder
        await expect(combobox).toHaveValue('');
        await expect(combobox).toHaveAttribute('placeholder', 'Select an option');

        // # Open the Location combobox
        await combobox.click();

        // * Verify the options are listed in definition order
        await expect(location.choiceList.locator).toHaveText(['Remote', 'Office', 'Hybrid']);

        // # Type part of an option name
        await combobox.fill('Off');

        // * Verify only the matching option is listed
        await expect(location.choiceList.locator).toHaveText(['Office']);

        // # Pick Office
        await location.choice({id: optionId(locationField, 'Office')}).container.click();

        // * Verify the menu closes and the input shows the option label
        await expect(combobox).toHaveAttribute('aria-expanded', 'false');
        await expect(combobox).toHaveValue('Office');

        // # Click Save button and confirm
        let confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * Verify success; the input still shows the label
        await expect(userDetail.saveButton).toBeSaved();
        await expect(userDetail.saveErrorText).not.toBeVisible();
        await expect(combobox).toHaveValue('Office');

        // * Verify the option id was stored
        await expect
            .poll(() => adminClient.getUserCustomProfileAttributesValues(testUser.id))
            .toMatchObject({[locationField.id]: optionId(locationField, 'Office')});

        // # Clear the selection with the clear button
        await location.clearButton.click();

        // * Verify the input is empty and the clear button is gone
        await expect(combobox).toHaveValue('');
        await expect(location.clearButton).not.toBeVisible();

        // # Click Save button and confirm
        confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * Verify success and that the stored value was cleared
        await expect(userDetail.saveButton).toBeSaved();
        await expect(userDetail.saveErrorText).not.toBeVisible();
        await expect
            .poll(() => adminClient.getUserCustomProfileAttributesValues(testUser.id))
            .toMatchObject({[locationField.id]: ''});
    });

    test('Should display custom multiselect attribute and save form', async () => {
        const userDetail = adminApp().admin.user;
        const skillsField = field(cpaFieldNames.skills);
        const skills = userDetail.attribute(skillsField);
        const chips = comboboxChips(skills);

        // * Verify Skills multiselect component is displayed with no chips
        await expect(skills.valueChoiceCombobox).toBeVisible();
        await expect(chips).toHaveCount(0);

        // # Pick JavaScript and React
        await skills.valueChoiceCombobox.choose('JavaScript');
        await expect(chips).toHaveText(['JavaScript']);
        await skills.valueChoiceCombobox.choose('React');

        // * Verify both show as chips in pick order
        await expect(chips).toHaveText(['JavaScript', 'React']);

        // # Remove the React chip
        await removeComboboxChip(skills, 'React');

        // * Verify only JavaScript remains
        await expect(chips).toHaveText(['JavaScript']);

        // # Make a change to a different field too
        const departmentInput = attributeInput(cpaFieldNames.department);
        await departmentInput.fill('Engineering Updated');

        // # Verify save button becomes enabled
        await expect(userDetail.saveButton).toBeEnabled();

        // # Save the form and confirm
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * Verify the save completed without an error message
        await expect(userDetail.saveErrorText).not.toBeVisible();
        await expect(userDetail.saveButton).toBeSaved();

        // * Verify the changes persisted in the UI and on the server
        await expect(departmentInput).toHaveValue('Engineering Updated');
        await expect(chips).toHaveText(['JavaScript']);
        await expect
            .poll(() => adminClient.getUserCustomProfileAttributesValues(testUser.id))
            .toMatchObject({[skillsField.id]: [optionId(skillsField, 'JavaScript')]});
    });

    /**
     * @objective Verify clicking a multiselect attribute's field name focuses its combobox without removing a chip or changing the value.
     */
    test(
        'clicking a multiselect attribute name focuses its input and keeps its chips',
        {tag: '@user_management'},
        async () => {
            const userDetail = adminApp().admin.user;
            const skillsField = field(cpaFieldNames.skills);
            const skills = userDetail.attribute(skillsField);
            const skillsCombobox = skills.valueChoiceCombobox.locator;
            const skillsLabel = skills.nameText.locator;
            const chips = comboboxChips(skills);

            // * Verify the field name is the combobox's label
            await expect(skillsCombobox).toHaveAccessibleName(skillsField.attrs?.display_name || skillsField.name);

            // # Pick two skills and save them
            await skills.valueChoiceCombobox.choose('JavaScript');
            await expect(chips).toHaveText(['JavaScript']);
            await skills.valueChoiceCombobox.choose('React');
            await expect(chips).toHaveText(['JavaScript', 'React']);
            const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
            await confirm.confirmButton.click();
            await expect(userDetail.saveButton).toBeSaved();

            // # Move focus to another field
            await attributeInput(cpaFieldNames.department).focus();
            await expect(skillsCombobox).not.toBeFocused();

            // # Click the Skills field name
            await skillsLabel.click();

            // * Verify the combobox is focused, both chips remain, and nothing changed
            await expect(skillsCombobox).toBeFocused();
            await expect(chips).toHaveText(['JavaScript', 'React']);
            await expect(userDetail.saveButton).toBeDisabled();
            await expect(userDetail.cancelButton).not.toBeVisible();
        },
    );

    test('Should validate invalid email and show error with cancel option', async () => {
        const userDetail = adminApp().admin.user;

        // Re-apply the fields intercept for this validation test.
        // Without it, a concurrent CPA test's afterEach can delete our fields via the
        // setupCustomProfileAttributeFields early-return bug. The server then emits
        // WebsocketEventCPAFieldDeleted; the browser re-fetches /fields; Redux clears;
        // handleCpaValueChange finds field===undefined and skips setting the error state,
        // so the field-error element never renders and the assertion times out.
        const frozenFields = Object.values(attributeFieldsMap);
        await adminApp().page.route('**/api/v4/custom_profile_attributes/fields', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(frozenFields),
            });
        });
        // # Find CPA email field (Work Email)
        const workEmailInput = attributeInput(cpaFieldNames.workEmail);
        await workEmailInput.scrollIntoViewIfNeeded();
        const originalEmail = await workEmailInput.inputValue();

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email');

        // * Verify inline validation error appears
        const fieldError = userDetail.attribute(field(cpaFieldNames.workEmail)).errorAlert.locator;
        await expect(fieldError).toBeVisible({timeout: duration.half_min});
        await expect(fieldError).toContainMessage(Msg.admin.user_item.invalidEmail);

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is visible and enabled
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Test the cancel functionality
        await userDetail.cancelButton.click();

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
        const userDetail = adminApp().admin.user;

        // Re-apply the fields intercept — same race-condition guard as the email validation test.
        const frozenFields = Object.values(attributeFieldsMap);
        await adminApp().page.route('**/api/v4/custom_profile_attributes/fields', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(frozenFields),
            });
        });
        // # Find custom URL field (Personal Website)
        const urlInput = attributeInput(cpaFieldNames.personalWebsite);
        const originalUrl = await urlInput.inputValue();

        // # Enter invalid URL (specifically the one mentioned: "<%>")
        await urlInput.clear();
        await urlInput.fill('<%>');

        // * Verify inline validation error appears
        const fieldError = userDetail.attribute(field(cpaFieldNames.personalWebsite)).errorAlert.locator;
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText('Invalid URL');

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is visible
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Test cancel functionality
        await userDetail.cancelButton.click();

        // * Verify URL reverts to original value
        await expect(urlInput).toHaveValue(originalUrl);

        // * Verify validation error disappears
        await expect(fieldError).not.toBeVisible();

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();
    });

    test('Should validate invalid email in custom email attribute', async () => {
        const userDetail = adminApp().admin.user;

        // Re-apply the fields intercept — same race-condition guard as the other validation tests.
        const frozenFields = Object.values(attributeFieldsMap);
        await adminApp().page.route('**/api/v4/custom_profile_attributes/fields', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(frozenFields),
            });
        });
        // # Find custom email field (Work Email)
        const workEmailInput = attributeInput(cpaFieldNames.workEmail);

        // # Enter invalid email
        await workEmailInput.clear();
        await workEmailInput.fill('not-an-email-either');

        // * Verify inline validation error appears
        const fieldError = userDetail.attribute(field(cpaFieldNames.workEmail)).errorAlert.locator;
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainMessage(Msg.admin.user_item.invalidEmail);

        // * Verify Save button is disabled due to validation error
        await expect(userDetail.saveButton).toBeDisabled();

        // * Verify Cancel button is available
        await expect(userDetail.cancelButton).toBeVisible();
    });

    test('Should show save/cancel buttons when changes are made', async () => {
        const userDetail = adminApp().admin.user;

        // * Initially, Save should be disabled and Cancel should not be visible
        await expect(userDetail.saveButton).toBeDisabled();
        await expect(userDetail.cancelButton).not.toBeVisible();

        // # Make a change to trigger save needed state
        const departmentInput = attributeInput(cpaFieldNames.department);
        const originalValue = await departmentInput.inputValue();
        await departmentInput.clear();
        await departmentInput.fill('Changed Value');

        // * Verify Save button becomes enabled and Cancel button appears
        await expect(userDetail.saveButton).toBeEnabled();
        await expect(userDetail.cancelButton).toBeVisible();
        await expect(userDetail.cancelButton).toBeEnabled();

        // # Click Cancel
        await userDetail.cancelButton.click();

        // * Verify changes are reverted
        await expect(departmentInput).toHaveValue(originalValue);

        // * Verify Cancel button disappears
        await expect(userDetail.cancelButton).not.toBeVisible();

        // * Verify Save button is disabled
        await expect(userDetail.saveButton).toBeDisabled();
    });

    test('Should save all user attribute changes atomically', async () => {
        const userDetail = adminApp().admin.user;

        // # Make changes to both system and custom attributes
        const newEmail = `atomic-test-${testUser.email}`;
        await userDetail.emailTextbox.clear();
        await userDetail.emailTextbox.fill(newEmail);

        const departmentInput = attributeInput(cpaFieldNames.department);
        await departmentInput.clear();
        await departmentInput.fill('Sales');

        // # Click Save button and confirm
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * Verify both changes were saved successfully
        await expect(userDetail.saveErrorText).not.toBeVisible();
        await expect(userDetail.emailTextbox).toHaveValue(newEmail);
        await expect(departmentInput).toHaveValue('Sales');
        await expect(userDetail.saveButton).toBeSaved();
    });
});
