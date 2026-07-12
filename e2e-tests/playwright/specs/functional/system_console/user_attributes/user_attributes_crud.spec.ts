// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
