// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';
import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, test, type App, type PlaywrightExtended, Msg, Api, settle} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from './helpers';
import {
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
    deleteCustomProfileAttributes,
    verifyAttributesExistInSettings,
    verifyAttributeInPopover,
    verifyAttributeNotInPopover,
    editTextAttribute,
    editSelectAttribute,
    editMultiselectAttribute,
    attributeSection,
    getFieldIdByName,
    TEST_PHONE,
    TEST_UPDATED_PHONE,
    TEST_URL,
    TEST_UPDATED_URL,
    TEST_INVALID_URL,
    TEST_VALID_URL,
    TEST_DEPARTMENT,
    TEST_UPDATED_DEPARTMENT,
    TEST_CHANGED_VALUE,
    TEST_LOCATION_OPTIONS,
    TEST_SKILLS_OPTIONS,
    TEST_MESSAGE,
    TEST_MESSAGE_OTHER,
} from './helpers';

// Custom attribute definitions.
// Names are intentionally suffixed with 'US' to avoid sharing server fields with
// custom_attributes.spec.ts, which defines identically-typed 'Department', 'Phone',
// and 'Website' attributes.  With greedy-bin-packing shard balancing the two spec
// files often land in different shards; if they shared fields the owning spec's
// afterAll would delete the field while the other spec is still using it, causing
// consistent CI failures (observed as Department absent from the profile popover).
const customAttributes: CustomProfileAttribute[] = [
    {
        name: 'DepartmentUS',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'LocationUS',
        type: 'select',
        options: TEST_LOCATION_OPTIONS,
    },
    {
        name: 'SkillsUS',
        type: 'multiselect',
        options: TEST_SKILLS_OPTIONS,
    },
    {
        name: 'PhoneUS',
        value: TEST_PHONE,
        type: 'text',
        attrs: {
            value_type: 'phone',
        },
    },
    {
        name: 'WebsiteUS',
        value: TEST_URL,
        type: 'text',
        attrs: {
            value_type: 'url',
        },
    },
];

let team: Team;
let user: UserProfile;
let otherUser: UserProfile;
let testChannel: Channel;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;
let userClient: Client4;

test.beforeEach(async ({pw}) => {
    // Skip test if no license for "Custom Profile Attributes"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize with admin client
    ({team, user, adminClient, userClient} = await pw.initSetup({userOptions: {prefix: 'cpa-test-'}}));
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'test-channel',
        displayName: 'Test Channel',
    });
    testChannel = await adminClient.createChannel(channel);

    // Create another user to test profile popover
    otherUser = await pw.createNewUserProfile(adminClient, {prefix: 'cpa-other-'});
    await adminClient.addToTeam(team.id, otherUser.id);
    await adminClient.addToChannel(otherUser.id, testChannel.id);

    // Add the test user to the test channel
    await adminClient.addToChannel(user.id, testChannel.id);

    // Set up custom profile attribute fields
    attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, customAttributes);

    // Login as the test user
    const {page} = await pw.testBrowser.login(user);

    // Set up initial values for custom profile attributes
    await setupCustomProfileAttributeValues(userClient, customAttributes, attributeFieldsMap);

    // Visit the test channel
    await page.goto(`/${team.name}/channels/${testChannel.name}`);
});

test.afterAll(async () => {
    // Clean up by deleting custom profile attributes
    await deleteCustomProfileAttributes(adminClient, attributeFieldsMap);
});

/** Logs the user in on the test channel and opens Profile settings. */
async function openProfile(pw: PlaywrightExtended, who: UserProfile) {
    const {app} = await pw.testBrowser.login(who);
    await app.channelsPage.goto({team, channel: testChannel});
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
    const modal = await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
    await expect(modal).toBeVisible();
    return {app, modal};
}

/** Closes Profile settings. */
async function closeProfile(modal: Awaited<ReturnType<typeof openProfile>>['modal']) {
    await modal.closeButton.click();
    await expect(modal).not.toBeVisible();
}

/** Posts a message from the composer and returns the post id once it shows. */
async function postMessage(app: App, message: string) {
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    let id = '';
    await expect
        .poll(async () => {
            id = (await app.center.postList.postList.keys()).at(-1) ?? '';
            return id ? app.center.postList.post({id}).message.container.text() : '';
        })
        .toBe(message);
    return id;
}

/** Logs `viewer` in on the test channel and opens the profile popover from the post's avatar. */
async function openPopoverAs(pw: PlaywrightExtended, viewer: UserProfile, postId: string) {
    const {app} = await pw.testBrowser.login(viewer);
    await app.channelsPage.goto({team, channel: testChannel});
    // ProfilePicture exposes a role-free container, so the popover trigger has no click driver.
    await app.center.postList.post({id: postId}).avatar.container.click();
    await expect(app.profilePopover).toBeVisible();
    return app;
}

/**
 * Verify that users can edit different types of custom profile attributes
 * (text, select, and multiselect fields) and that changes appear correctly in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes:
 *    - Department (text field)
 *    - Location (select field with options: Remote, Office, Hybrid)
 *    - Skills (multiselect field with options: JavaScript, React, Node.js, Python)
 *    - Phone (text field with phone validation)
 *    - Website (text field with URL validation)
 * 3. Test user has initial values:
 *    - Department: Engineering
 *    - Phone: 555-123-4567
 *    - Website: https://example.com
 * 4. Two user accounts (test user and other user) exist
 * 5. Both users are members of the same channel
 */
test('MM-T5768 Editing Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user and open profile settings
    const {app, modal} = await openProfile(pw, user);

    // * Verify that custom profile attributes section exists
    await verifyAttributesExistInSettings(app, attributeFieldsMap, customAttributes);

    // 2. Edit the DepartmentUS attribute and change to "Product"
    await editTextAttribute(app, attributeFieldsMap, 'DepartmentUS', TEST_UPDATED_DEPARTMENT);

    // 3. Edit the LocationUS attribute (select field) and select "Remote" (index 0)
    await editSelectAttribute(app, attributeFieldsMap, 'LocationUS', 0);

    // 4. Edit the SkillsUS attribute (multiselect field) and select "Python" (index 3) and "Node.js" (index 2)
    await editMultiselectAttribute(app, attributeFieldsMap, 'SkillsUS', [3, 2]);

    // 5. Close the profile settings modal and post a message to make the user visible in the channel
    await closeProfile(modal);
    const postId = await postMessage(app, TEST_MESSAGE);

    // 6. Login as the other user and view the test user's profile popover
    const otherApp = await openPopoverAs(pw, otherUser, postId);

    // * Profile popover shows updated custom attributes
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'DepartmentUS', TEST_UPDATED_DEPARTMENT);
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'LocationUS', 'Remote');
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'SkillsUS', 'Python');
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'SkillsUS', 'Node.js');
});

/**
 * @objective Verify that a select custom profile attribute's input takes focus when its section opens and
 * its menu opens on click, and that keyboard use stays inside its dropdown: Escape with the menu open closes the menu
 * but not the profile modal, and Enter on an option picks it
 * without saving the section, which only saves when Save is clicked.
 *
 * @precondition
 * A test server with a valid license to support Custom Profile Attributes, with a LocationUS select
 * attribute (options Remote, Office, Hybrid) that the test user has not set.
 */
test(
    'select attribute keyboard picks without saving and Escape keeps the profile modal open',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        const {app, modal} = await openProfile(pw, user);
        await verifyAttributesExistInSettings(app, attributeFieldsMap, customAttributes);

        // # Edit the LocationUS attribute
        const section = attributeSection(app, attributeFieldsMap, 'LocationUS');
        await section.editButton.click();

        // * The input takes focus when the section opens
        const input = section.valueChoiceCombobox.locator;
        await expect(input).toBeFocused();
        const valueBefore = await input.inputValue();

        // # Click the input
        await input.click();

        // * The menu opens with the input focused
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute('aria-expanded', 'true');

        // # Press Escape with the menu open
        await app.page.keyboard.press('Escape');

        // * The menu closes, while the modal and the section stay open
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(input).toBeFocused();
        await expect(modal).toBeVisible();
        await expect(section.saveButton).toBeVisible();

        // # Reopen the menu with ArrowDown, move to the next option and pick it with Enter
        await app.page.keyboard.press('ArrowDown');
        await expect(input).toHaveAttribute('aria-expanded', 'true');

        // * The modal is still open after the Escape
        await expect(modal).toBeVisible();

        await app.page.keyboard.press('ArrowDown');
        await expect(input).toHaveAttribute('aria-activedescendant', /.+/);
        await app.page.keyboard.press('Enter');

        // * The option is picked but the section has not saved
        await expect(input).not.toHaveValue(valueBefore);
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(section.editButton).not.toBeVisible();
        await expect(section.saveButton).toBeVisible();
        const pickedValue = await input.inputValue();
        expect(TEST_LOCATION_OPTIONS.map((option) => option.name)).toContain(pickedValue);

        // # Save the section
        await section.saveButton.click();

        // * The section closes and shows the picked value
        await expect(section.editButton).toBeVisible();
        await expect(section.describeText).toContainText(pickedValue);
    },
);

/**
 * @objective Verify that clicking the open dropdown menu outside its options keeps focus on the select
 * custom profile attribute, so the next Escape closes only the menu and not the profile modal.
 *
 * @precondition
 * A test server with a valid license to support Custom Profile Attributes, with a LocationUS select
 * attribute (options Remote, Office, Hybrid).
 */
test(
    'clicking the select attribute menu outside an option keeps focus and Escape keeps the profile modal open',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        const {app, modal} = await openProfile(pw, user);

        // # Edit the LocationUS attribute
        const section = attributeSection(app, attributeFieldsMap, 'LocationUS');
        await section.editButton.click();

        // * The input takes focus when the section opens
        const input = section.valueChoiceCombobox.locator;
        await expect(input).toBeFocused();

        // # Click the input to open the menu
        await input.click();
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute('aria-expanded', 'true');

        // # Click the menu padding just above its first option
        const locationOptions = (attributeFieldsMap[getFieldIdByName(attributeFieldsMap, 'LocationUS')].attrs
            ?.options ?? []) as Array<{id: string}>;
        const firstOptionId = locationOptions.at(0)?.id;
        if (!firstOptionId) {
            throw new Error('Expected the LocationUS attribute to have options');
        }
        const firstChoice = section.choice({id: firstOptionId});
        const firstOption = firstChoice.container.locator;

        // The menu ignores the pointer for a couple of frames after aria-expanded flips, then
        // scales in; a trial click waits until the option is stable and receives pointer events.
        await firstOption.click({trial: true});
        await expect(firstOption).toBeVisible();
        const optionBox = await firstOption.boundingBox();
        if (!optionBox) {
            throw new Error('Expected the first option to have a bounding box');
        }
        const point = {x: optionBox.x + optionBox.width / 2, y: optionBox.y - 3};
        const hitsMenuPadding = await firstOption.evaluate((option, {x, y}) => {
            const el = document.elementFromPoint(x, y);
            const popup = option.closest('[class*="combobox__popup"]');
            return Boolean(el && popup?.contains(el) && !el.closest('[role="option"]'));
        }, point);
        expect(
            hitsMenuPadding,
            'the click point must land on the menu padding, not an option or outside the menu',
        ).toBe(true);
        await app.page.mouse.click(point.x, point.y);

        // * The menu stays open and the input keeps focus
        await expect(input).toHaveAttribute('aria-expanded', 'true');
        await expect(input).toBeFocused();

        // # Press Escape
        await app.page.keyboard.press('Escape');

        // * The menu closes, while the modal and the section stay open
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(input).toBeFocused();
        await expect(modal).toBeVisible();
        await expect(section.saveButton).toBeVisible();
    },
);

/**
 * Verify that users can clear custom profile attribute values and that cleared
 * attributes with "when_set" visibility aren't displayed in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has Department value set to "Engineering"
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5769 Clearing Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user, after the other user has posted in the channel
    await pw.postAs(otherUser, {
        channel_id: testChannel.id,
        message: TEST_MESSAGE_OTHER,
    });
    const {app, modal} = await openProfile(pw, user);

    // 2. Edit DepartmentUS field and delete all text to clear the value
    await editTextAttribute(app, attributeFieldsMap, 'DepartmentUS', '');

    // 3. Close the profile settings modal and post a message to make the user visible in the channel
    await closeProfile(modal);
    const postId = await postMessage(app, 'Testing cleared attributes');

    // 4. Login as the other user and view the test user's profile popover
    const otherApp = await openPopoverAs(pw, otherUser, postId);

    // * DepartmentUS attribute is not displayed in the profile popover (other attributes are)
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'PhoneUS', TEST_PHONE);
    await verifyAttributeNotInPopover(otherApp, attributeFieldsMap, 'DepartmentUS');
});

/**
 * Verify that cancelling changes to custom profile attributes properly
 * discards the changes without saving them.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has Department value set to "Engineering"
 */
test('MM-T5770 Cancelling Changes to Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user and open profile settings
    const {app} = await openProfile(pw, user);
    const section = attributeSection(app, attributeFieldsMap, 'DepartmentUS');

    // 2. Edit DepartmentUS field and change to "Changed Value"
    await section.editButton.click();
    await expect(section.value.container).toBeVisible();
    await section.value.container.clear();
    await section.value.container.fill(TEST_CHANGED_VALUE);

    // 3. Click Cancel button
    await section.cancelButton.click();
    await expect(section.editButton).toBeVisible();

    // 4. Open DepartmentUS field for editing again
    await section.editButton.click();
    await expect(section.value.container).toBeVisible();

    // * After cancelling, DepartmentUS field should still show original value "Engineering"
    await expect(section.value.container).toHaveValue(TEST_DEPARTMENT);
});

/**
 * Verify that users can edit custom profile attributes with specialized formats
 * (phone numbers and URLs) and that they display correctly in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has initial values:
 *    - Phone: 555-123-4567
 *    - Website: https://example.com
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5771 Editing Phone and URL Type Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user, after the other user has posted in the channel
    await pw.postAs(otherUser, {
        channel_id: testChannel.id,
        message: TEST_MESSAGE_OTHER,
    });
    const {app, modal} = await openProfile(pw, user);

    // 2. Edit PhoneUS field and change to "555-987-6543", and WebsiteUS to "https://mattermost.com"
    await editTextAttribute(app, attributeFieldsMap, 'PhoneUS', TEST_UPDATED_PHONE);
    await editTextAttribute(app, attributeFieldsMap, 'WebsiteUS', TEST_UPDATED_URL);

    // 3. Close the profile settings modal and post a message to make the user visible in the channel
    await closeProfile(modal);
    const postId = await postMessage(app, 'Testing phone and URL attributes');

    // 4. Login as the other user and view the test user's profile popover
    const otherApp = await openPopoverAs(pw, otherUser, postId);

    // * Profile popover shows updated attributes
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'PhoneUS', TEST_UPDATED_PHONE);
    await verifyAttributeInPopover(otherApp, attributeFieldsMap, 'WebsiteUS', TEST_UPDATED_URL);
});

/**
 * Verify that URL validation works properly for custom profile attributes,
 * showing errors for invalid URLs and allowing valid ones.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created Website custom profile attribute with URL validation
 * 3. Test user has Website value set to "https://example.com"
 */
test('MM-T5772 URL Validation in Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user and open profile settings
    const {app} = await openProfile(pw, user);
    const section = attributeSection(app, attributeFieldsMap, 'WebsiteUS');

    // 2. Edit WebsiteUS field and enter an invalid URL
    await section.editButton.click();
    await expect(section.value.container).toBeVisible();
    await section.value.container.clear();
    await section.value.container.fill(TEST_INVALID_URL);
    await section.value.container.blur();

    // * The field shows the invalid URL error
    await expect(section.value.validationAlert).toHaveMessage(Msg.user.settings.general.validUrl);

    // 3. Enter a valid URL and save
    await section.value.container.clear();
    await section.value.container.fill(TEST_VALID_URL);
    await section.saveButton.click();

    // * Valid URL saves successfully with no error message
    await expect(section.editButton).toBeVisible();
    await expect(section.value.validationAlert).not.toBeVisible();
    await expect(section.describeText).toContainText(TEST_VALID_URL);
});
