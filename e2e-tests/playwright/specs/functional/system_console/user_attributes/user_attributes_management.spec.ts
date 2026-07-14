// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, test} from '@mattermost/playwright-lib';

import {
    type CustomProfileAttribute,
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeValuesForUser,
} from '../../channels/custom_profile_attributes/helpers';

function matchingOrder(actual: string[], expected: string[]) {
    return actual.filter((value) => expected.includes(value));
}

/**
 * @objective Verify navigating to the User Attributes page shows the empty state and disabled Save button.
 */
test('MM-T5745 navigates to user attributes page and displays empty state', {tag: '@user_attributes'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
    const {adminClient, adminUser} = await pw.initSetup();

    // Custom profile attribute fields are global, so other specs may have left fields behind
    // for reuse. Clear them to exercise the empty state, then restore them in `finally` so
    // this test does not permanently wipe fields other specs depend on.
    const existing = await adminClient.getCustomProfileAttributeFields();
    try {
        if (existing.length) {
            const fields = Object.fromEntries(existing.map((field) => [field.id, field]));
            await deleteCustomProfileAttributes(adminClient, fields);
        }

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to User Attributes via the sidebar
        await systemConsolePage.sidebar.systemAttributes.userAttributes.click();
        const sp = systemConsolePage.systemProperties;

        // * Verify the empty management page and disabled Save button
        await sp.toBeVisible();
        await expect(sp.addAttributeButton).toBeVisible();
        await expect(sp.saveButton).toBeVisible();
        await expect(sp.saveButton).toBeDisabled();
    } finally {
        for (const field of existing) {
            try {
                await adminClient.createCustomProfileAttributeField({
                    name: field.name,
                    type: field.type,
                    attrs: field.attrs,
                });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log(`Failed to restore custom profile attribute field ${field.name}:`, error);
            }
        }
    }
});

/**
 * @objective Verify a system admin can add, edit, and delete a user attribute.
 */
test('MM-T5746 adds, edits, and deletes a user attribute', {tag: '@user_attributes'}, async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
    await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
    const {adminClient, adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    const sp = systemConsolePage.systemProperties;
    const originalName = `attr_${pw.random.id()}`.padEnd(40, '0').slice(0, 40);
    const updatedName = `edited_${pw.random.id()}`;

    // # Add and save a maximum-length user attribute
    await sp.goto();
    await sp.addAttribute();
    await sp.lastNameInput().fill(originalName);
    await sp.lastNameInput().press('Tab');
    await sp.saveAndWaitForSettled();

    // * Verify the new attribute persisted
    let fields = await adminClient.getCustomProfileAttributeFields();
    const created = fields.find((field) => field.name === originalName);
    expect(created).toBeDefined();
    await expect(sp.nameInputByValue(originalName)).toHaveValue(originalName);

    // # Rename and save the attribute
    await sp.nameInputByValue(originalName).fill(updatedName);
    await systemConsolePage.page.keyboard.press('Tab');
    await sp.saveAndWaitForSettled();
    fields = await adminClient.getCustomProfileAttributeFields();
    // * Verify the renamed attribute persisted
    const updated = fields.find((field) => field.name === updatedName);
    expect(updated).toBeDefined();

    // # Delete and save the attribute
    await sp.openDotMenu(updated!.id);
    await sp.deleteAttribute();
    await sp.confirmDeletion();
    await sp.saveAndWaitForSettled();

    // * Verify the attribute was deleted
    fields = await adminClient.getCustomProfileAttributeFields();
    expect(fields.find((field) => field.id === updated!.id)).toBeUndefined();
});

/**
 * @objective Verify reordering attributes in the System Console updates profile settings and popover order.
 */
test(
    'MM-T5766 propagates reordered user attributes to profile settings and popover',
    {tag: '@user_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('CustomProfileAttributes', true);
        const {adminClient, adminUser, team, user} = await pw.initSetup();
        const suffix = pw.random.id();
        const labels = [`First ${suffix}`, `Second ${suffix}`, `Favorite Food ${suffix}`];
        const fields: Record<string, UserPropertyField> = {};

        for (const [index, label] of labels.entries()) {
            const field = await adminClient.createCustomProfileAttributeField({
                name: `reorder_${index}_${suffix}`,
                type: 'text',
                attrs: {display_name: label, sort_order: 1000 + index, visibility: 'always'},
            } as any);
            fields[field.id] = field;
        }

        const attributes: CustomProfileAttribute[] = labels.map((label, index) => ({
            name: `reorder_${index}_${suffix}`,
            type: 'text',
            value: `Value ${index + 1}`,
            attrs: {display_name: label, visibility: 'always'},
        }));

        await setupCustomProfileAttributeValuesForUser(adminClient, attributes, fields, user.id);
        // # Move Favorite Food to the top in the System Console and save
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const sp = systemConsolePage.systemProperties;
        await sp.goto();
        await sp.reorderButtonByName(`reorder_2_${suffix}`).press('ArrowUp');
        await sp.reorderButtonByName(`reorder_2_${suffix}`).press('ArrowUp');
        await sp.saveAndWaitForSettled();

        const expectedOrder = [labels[2], labels[0], labels[1]];
        // * Verify the new order in profile settings
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        const profileModal = await channelsPage.openProfileModal();
        expect(matchingOrder(await profileModal.sectionHeadings.allTextContents(), labels)).toEqual(expectedOrder);
        await profileModal.closeModal();

        // # Open the user's profile popover
        await channelsPage.postMessage(`Reordered attributes ${suffix}`);
        const post = await channelsPage.getLastPost();
        const popover = await channelsPage.openProfilePopover(post);
        // * Verify the new order in the popover
        expect(matchingOrder(await popover.attributeHeadings.allTextContents(), labels)).toEqual(expectedOrder);
    },
);
