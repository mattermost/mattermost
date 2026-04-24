// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    verifyAttributeInPopover,
    editTextAttribute,
    getFieldIdByName,
    TEST_UPDATED_PHONE,
    TEST_UPDATED_URL,
    TEST_INVALID_URL,
    TEST_VALID_URL,
    TEST_MESSAGE_OTHER,
} from './helpers';
import {setupCpaTestEnvironment, teardownCpaTestEnvironment, userSettingsCustomAttributes} from './support';

const customAttributes = userSettingsCustomAttributes;

let user: UserProfile;
let otherUser: UserProfile;
let testChannel: Channel;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;

test.beforeEach(async ({pw}) => {
    ({user, otherUser, testChannel, attributeFieldsMap, adminClient} = await setupCpaTestEnvironment(
        pw,
        customAttributes,
    ));
});

test.afterAll(async () => {
    await teardownCpaTestEnvironment(adminClient, attributeFieldsMap);
});

/**
 * Verify that users can edit custom profile attributes with specialized formats
 * (phone numbers and URLs) and that they display correctly in the profile popover.
 */
test('MM-T5771 Editing Phone and URL Type Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // Prepare the environment by posting a message as other user
    await adminClient.createPost({
        channel_id: testChannel.id,
        message: TEST_MESSAGE_OTHER,
        user_id: otherUser.id,
    });

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // 3. Edit Phone field and change to "555-987-6543"
    await editTextAttribute(page, attributeFieldsMap, 'Phone', TEST_UPDATED_PHONE);

    // 4. Edit Website field and change to "https://mattermost.com"
    await editTextAttribute(page, attributeFieldsMap, 'Website', TEST_UPDATED_URL);

    // 5. Close the profile settings modal
    await profileModal.closeModal();

    // 6. Post a message to make the user visible in the channel
    await channelsPage.postMessage('Testing phone and URL attributes');

    // 7. Login as the other user
    const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(otherUser);
    await otherChannelsPage.goto();

    // 8. View the test user's profile popover
    const lastPost = await otherChannelsPage.getLastPost();
    await otherChannelsPage.openProfilePopover(lastPost);

    // * Profile popover shows updated attributes
    await verifyAttributeInPopover(otherChannelsPage, 'Phone', TEST_UPDATED_PHONE);
    await verifyAttributeInPopover(otherChannelsPage, 'Website', TEST_UPDATED_URL);
});

/**
 * Verify that URL validation works properly for custom profile attributes,
 * showing errors for invalid URLs and allowing valid ones.
 */
test('MM-T5772 URL Validation in Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // 3. Edit Website field and enter an invalid URL
    const fieldId = getFieldIdByName(attributeFieldsMap, 'Website');
    await profileModal.container.locator(`text=Website`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_INVALID_URL);
    await profileModal.container.locator(`#customAttribute_${fieldId}`).blur();

    // * Save button doesn't complete the operation with invalid URL
    await expect(profileModal.container.locator(`#error_customAttribute_${fieldId}`)).toBeVisible();
    await expect(profileModal.container.locator(`#error_customAttribute_${fieldId}`)).toHaveText(
        'Please enter a valid url.',
    );

    // 5. Edit Website field and enter a valid URL
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_VALID_URL);

    // 6. Save the changes
    await profileModal.saveButton.click();

    // * Valid URL saves successfully with no error message
    await expect(profileModal.container.locator(`#error_customAttribute_${fieldId}`)).not.toBeVisible();
    await expect(profileModal.container).toContainText(TEST_VALID_URL);
});
