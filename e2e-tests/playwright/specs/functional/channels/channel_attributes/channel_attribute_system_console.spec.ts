// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Channel Configuration's "Channel attributes" section
 * (MM-70717 follow-up). Lets a sysadmin set a channel's attribute values
 * directly, without visiting the channel itself. Edits batch under the
 * page's own Save Changes bar rather than saving per field.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {expect, systemConsolePath, test, type App} from '@mattermost/playwright-lib';

import {
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    valueFor,
} from './helpers';

const CHANNELS_PATH = systemConsolePath('user_management/channels');

/** Opens a channel's page in Channel Configuration and returns its attributes section. */
async function openChannelConfiguration(app: App, channel: {id: string}) {
    await app.page.goto(systemConsolePath(`user_management/channels/${channel.id}`));
    return app.admin.channel;
}

test.describe('System Console - Channel attributes section', {tag: ['@channel_attributes', '@system_console']}, () => {
    test.describe.configure({mode: 'serial'});

    // Attributes a test created, removed after it whether it passed or not.
    const created: PropertyField[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await deleteAttributes(adminClient, created.splice(0));
    });

    /**
     * @objective Verify a select attribute's value can be set from the channel
     * details page, that it does not persist until the page Save is clicked,
     * and that it is stored correctly once saved.
     */
    test('sets a channel attribute value from Channel Configuration, batched under Save', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();

        await purgeAttributes(adminClient);

        const program = await createAttribute(adminClient, attributeName('program', suffix), {
            type: 'select',
            options: ['AURORA', 'ZEPHYR'],
        });
        created.push(program);

        const channel = await createChannelForAttributes(adminClient, team, `sysconsole-set-${suffix}`);

        const {app} = await pw.testBrowser.login(adminUser);
        const {attributes, savePanel} = await openChannelConfiguration(app, channel);

        const trigger = attributes.selectValue(program.id);
        await expect(trigger).toBeVisible();

        // # Pick a value, but do not save yet
        await trigger.clickTo(attributes.selectOption(optionId(program, 'AURORA')));
        await attributes.selectOption(optionId(program, 'AURORA')).click();

        // A Save click while the menu is still closing lands on its backdrop.
        await expect(attributes.selectOption(optionId(program, 'AURORA'))).toHaveCount(0);
        await expect(trigger).toContainText('AURORA');

        // * The pending edit has not reached the server
        expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBeUndefined();

        // # Save the page
        await expect(savePanel.saveButton).toBeEnabled();
        await savePanel.saveButton.click();
        await expect(app.page).toHavePath(CHANNELS_PATH);

        // * The value is now stored
        await expect
            .poll(async () => valueFor(await readChannelValues(adminClient, channel.id), program))
            .toBe(optionId(program, 'AURORA'));
    });

    /**
     * @objective Verify an attribute locked to permission_values="none" cannot be
     * edited from the channel details page, even by a sysadmin.
     */
    test('renders a permission_values="none" attribute as disabled', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();

        await purgeAttributes(adminClient);

        const locked = await createAttribute(adminClient, attributeName('locked', suffix), {
            type: 'select',
            options: ['ONE'],
            permissionValues: 'none',
        });
        created.push(locked);

        const channel = await createChannelForAttributes(adminClient, team, `sysconsole-locked-${suffix}`);

        const {app} = await pw.testBrowser.login(adminUser);
        const {attributes} = await openChannelConfiguration(app, channel);

        const trigger = attributes.selectValue(locked.id);
        await expect(trigger).toBeVisible();
        await expect(trigger).toBeDisabled();
    });

    /**
     * @objective Verify a select value can be cleared from its chip, and that
     * Save stays disabled while a required one is cleared.
     */
    test('refuses to save a cleared required value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();

        await purgeAttributes(adminClient);

        const channel = await createChannelForAttributes(adminClient, team, `sysconsole-clear-${suffix}`);

        // Backfills every active channel, this one included, with AURORA.
        const program = await createAttribute(adminClient, attributeName('program', suffix), {
            type: 'select',
            options: ['AURORA', 'ZEPHYR'],
            required: true,
        });
        created.push(program);

        const {app} = await pw.testBrowser.login(adminUser);
        const {attributes, savePanel} = await openChannelConfiguration(app, channel);
        const trigger = attributes.selectValue(program.id);
        await expect(trigger).toContainText('AURORA');

        // # Clear the value from its chip
        await attributes.selectValueRemove(optionId(program, 'AURORA')).click();
        await expect(trigger).toContainText('Not set');

        // * Save is disabled with an error, and the value is still stored
        await expect(savePanel.saveButton).toBeDisabled();
        await expect(app.admin.channel.attributesRequiredText).toContainText(
            /before saving\. This attribute is required\./,
        );
        await expect(attributes.requiredError(program.id)).toBeVisible();
        expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBe(optionId(program, 'AURORA'));
    });

    /**
     * @objective Verify unarchiving from Channel Configuration needs every
     * required attribute set first, since its editor is on the same page.
     */
    test('refuses to unarchive until required values are set', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const suffix = pw.random.id();

        await purgeAttributes(adminClient);

        const channel = await createChannelForAttributes(adminClient, team, `sysconsole-unarchive-${suffix}`);
        await adminClient.deleteChannel(channel.id);

        // Archived channels are not backfilled, so this one has no value.
        const program = await createAttribute(adminClient, attributeName('program', suffix), {
            type: 'select',
            options: ['AURORA', 'ZEPHYR'],
            required: true,
        });
        created.push(program);

        const {app} = await pw.testBrowser.login(adminUser);
        const {attributes, profile, savePanel} = await openChannelConfiguration(app, channel);

        // # Unarchive without setting the value
        const trigger = attributes.selectValue(program.id);
        await profile.toggleArchiveButton.clickTo(trigger);
        await expect(trigger).toContainText('Not set');

        // * Save is disabled and the channel stays archived
        await expect(savePanel.saveButton).toBeDisabled();
        await expect(app.admin.channel.attributesRequiredText).toContainText(
            /before saving\. This attribute is required\./,
        );
        expect((await adminClient.getChannel(channel.id)).delete_at).not.toBe(0);

        // # Set the value and save
        await trigger.clickTo(attributes.selectOption(optionId(program, 'ZEPHYR')));
        await attributes.selectOption(optionId(program, 'ZEPHYR')).click();
        await expect(trigger).toContainText('ZEPHYR');
        await savePanel.saveButton.click();

        // * The channel is unarchived with the value stored
        await expect(app.page).toHavePath(CHANNELS_PATH);
        await expect.poll(async () => (await adminClient.getChannel(channel.id)).delete_at).toBe(0);
        expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBe(optionId(program, 'ZEPHYR'));
    });
});
