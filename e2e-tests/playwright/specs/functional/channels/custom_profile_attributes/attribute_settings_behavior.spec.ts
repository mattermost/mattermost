// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {expect, test, type App, type PlaywrightExtended, DefaultChannel} from '@mattermost/playwright-lib';

import type {CpaFieldsMap, CustomProfileAttribute} from './helpers';
import {
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

// Custom profile attribute fields are server-wide: a field created by one test here (e.g. the
// "Cancel Test" field below) stays visible in every user's Profile modal for the rest of the CI
// job, breaking unrelated specs whose locators assume a generic set of sections. Track whichever
// fields the running test owns and delete them afterward.
let ownedFields: {adminClient: Client4; fields: CpaFieldsMap} | undefined;

/** Logs the user in and opens Profile settings. */
async function openProfile(pw: PlaywrightExtended, user: UserProfile) {
    const {app} = await pw.testBrowser.login(user);
    const team = (await (await pw.makeClient(user)).client.getMyTeams())[0];
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
    const modal = await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    await expect(modal).toBeVisible();
    return {app, modal};
}

/** The Profile settings section of the created attribute (the only field created by the test). */
function attributeSection(app: App, fields: CpaFieldsMap) {
    const field = Object.values(fields).find((value): value is UserPropertyField => !(value instanceof Set));
    if (!field) {
        throw new Error('The custom attribute field was not created');
    }
    return app.settings.customAttribute(field);
}

test.afterEach(async () => {
    if (!ownedFields) {
        return;
    }
    await deleteCustomProfileAttributes(ownedFields.adminClient, ownedFields.fields);
    ownedFields = undefined;
});

/**
 * @objective Verify maximum-length attribute names and values display with ellipsis styling in profile settings.
 */
test(
    'MM-T5748 displays long attribute names and values correctly in profile settings',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, user, userClient} = await pw.initSetup();
        const displayName = '40_characters_allowed_000000000000000000';
        const value = '64-characters-allowed-000000000000000000123456789012345678901234';
        const attributes: CustomProfileAttribute[] = [
            {
                name: `long_${pw.random.id()}`,
                type: 'text',
                value,
                attrs: {display_name: displayName},
            },
        ];
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);
        ownedFields = {adminClient, fields};

        await setupCustomProfileAttributeValues(userClient, attributes, fields);
        // # Open profile settings containing the maximum-length attribute
        const {app} = await openProfile(pw, user);
        const section = attributeSection(app, fields);

        // * Verify the full label/value exist and the value uses ellipsis styling
        await expect(section.titleText).toHaveText(displayName);
        await expect(section.describeText).toHaveText(value);
        await expect(section.describeText).toHaveCSS('text-overflow', 'ellipsis');
    },
);

/**
 * @objective Verify cancelling an attribute edit discards the unsaved value.
 */
test(
    'MM-T5749 cancels custom profile attribute changes without saving',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, user, userClient} = await pw.initSetup();
        const suffix = pw.random.id();
        const displayName = `Cancel Test ${suffix}`;
        const originalValue = `Original ${suffix}`;
        const attributes: CustomProfileAttribute[] = [
            {
                name: `cancel_${suffix}`,
                type: 'text',
                value: originalValue,
                attrs: {display_name: displayName},
            },
        ];
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);
        ownedFields = {adminClient, fields};
        await setupCustomProfileAttributeValues(userClient, attributes, fields);

        const {app} = await openProfile(pw, user);
        const section = attributeSection(app, fields);

        // # Change the unique attribute value, then cancel the edit
        await section.editButton.click();
        await expect(section.value.container).toBeVisible();
        await section.value.container.fill(`Unsaved ${suffix}`);
        await section.cancelButton.click();
        await expect(section.editButton).toBeVisible();

        // * Verify editing again shows the original persisted value
        await expect(section.describeText).toHaveText(originalValue);
        await section.editButton.click();
        await expect(section.value.container).toBeVisible();
        await expect(section.value.container).toHaveValue(originalValue);
    },
);

/**
 * @objective Verify deleting an attribute while a user edits it removes the editor without crashing.
 */
test(
    'MM-T5750 does not crash when an attribute is deleted while the user edits it',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, user, userClient} = await pw.initSetup();
        const displayName = `Favorite Color ${pw.random.id()}`;
        const attributes: CustomProfileAttribute[] = [
            {
                name: `color_${pw.random.id()}`,
                type: 'text',
                value: 'Blue',
                attrs: {display_name: displayName},
            },
        ];
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);
        ownedFields = {adminClient, fields};
        const fieldId = Object.keys(fields)[0];
        await setupCustomProfileAttributeValues(userClient, attributes, fields);

        // # Open the attribute editor and change its unsaved value
        const {app, modal} = await openProfile(pw, user);
        const section = attributeSection(app, fields);
        await section.editButton.click();
        await expect(section.value.container).toBeVisible();
        await section.value.container.fill('Green');
        await expect(section.value.container).toHaveValue('Green');

        // # Delete the attribute concurrently through the admin API
        await adminClient.deleteCustomProfileAttributeField(fieldId);

        // * Verify the editor disappears and the application remains usable
        await expect(section.value.container).not.toBeVisible();
        await expect(modal.closeButton).toBeVisible();
        await modal.closeButton.click();
        await expect(modal).not.toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();
    },
);
