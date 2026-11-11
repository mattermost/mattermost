// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Channel Configuration's "Channel attributes" section
 * (MM-70717 follow-up). Lets a sysadmin set a channel's attribute values
 * directly, without visiting the channel itself. Edits batch under the
 * page's own Save Changes bar rather than saving per field.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

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

test.describe('System Console - Channel attributes section', {tag: ['@channel_attributes', '@system_console']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a select attribute's value can be set from the channel
     * details page, that it does not persist until the page Save is clicked,
     * and that it is stored correctly once saved.
     */
    test('sets a channel attribute value from Channel Configuration, batched under Save', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await getAdminClient();
        if (!adminUser || !adminClient) {
            throw new Error('Admin user/client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('program', suffix), {
                type: 'select',
                options: ['AURORA', 'ZEPHYR'],
            });
            created.push(program);

            const {team} = await pw.initSetup();
            const channel = await createChannelForAttributes(adminClient, team, `sysconsole-set-${suffix}`);

            const {page} = await pw.testBrowser.login(adminUser);
            await page.goto(`/admin_console/user_management/channels/${channel.id}`);

            const trigger = page.getByTestId(`channelAttributesSettings-${program.name}`);
            await expect(trigger).toBeVisible();

            // # Pick a value, but do not save yet
            await trigger.click();
            await page.getByText('AURORA', {exact: true}).click();

            // A Save click while the menu is still closing lands on its backdrop.
            await expect(page.getByRole('menu')).toHaveCount(0);
            await expect(trigger).toContainText('AURORA');

            // * The pending edit has not reached the server
            expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBeUndefined();

            // # Save the page
            const saveButton = page.getByTestId('saveSetting');
            await expect(saveButton).toBeEnabled();
            await saveButton.click();
            await expect(page).toHaveURL(/\/admin_console\/user_management\/channels$/);

            // * The value is now stored
            await expect
                .poll(async () => valueFor(await readChannelValues(adminClient, channel.id), program))
                .toBe(optionId(program, 'AURORA'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify an attribute locked to permission_values="none" cannot be
     * edited from the channel details page, even by a sysadmin.
     */
    test('renders a permission_values="none" attribute as disabled', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await getAdminClient();
        if (!adminUser || !adminClient) {
            throw new Error('Admin user/client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const locked = await createAttribute(adminClient, attributeName('locked', suffix), {
                type: 'select',
                options: ['ONE'],
                permissionValues: 'none',
            });
            created.push(locked);

            const {team} = await pw.initSetup();
            const channel = await createChannelForAttributes(adminClient, team, `sysconsole-locked-${suffix}`);

            const {page} = await pw.testBrowser.login(adminUser);
            await page.goto(`/admin_console/user_management/channels/${channel.id}`);

            const trigger = page.getByTestId(`channelAttributesSettings-${locked.name}`);
            await expect(trigger).toBeVisible();
            await expect(trigger).toBeDisabled();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a select value can be cleared from its chip, and that
     * Save stays disabled while a required one is cleared.
     */
    test('refuses to save a cleared required value', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await getAdminClient();
        if (!adminUser || !adminClient) {
            throw new Error('Admin user/client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const {team} = await pw.initSetup();
            const channel = await createChannelForAttributes(adminClient, team, `sysconsole-clear-${suffix}`);

            // Backfills every active channel, this one included, with AURORA.
            const program = await createAttribute(adminClient, attributeName('program', suffix), {
                type: 'select',
                options: ['AURORA', 'ZEPHYR'],
                required: true,
            });
            created.push(program);

            const {page} = await pw.testBrowser.login(adminUser);
            await page.goto(`/admin_console/user_management/channels/${channel.id}`);
            await expect(page.getByTestId(`channelAttributesSettings-${program.name}`)).toContainText('AURORA');

            // # Clear the value from its chip
            await page.getByRole('button', {name: 'Remove AURORA'}).click();
            await expect(page.getByTestId(`channelAttributesSettings-${program.name}`)).toContainText('Not set');

            // * Save is disabled with an error, and the value is still stored
            await expect(page.getByTestId('saveSetting')).toBeDisabled();
            await expect(page.getByText(/before saving\. This attribute is required\./)).toBeVisible();
            await expect(page.getByText('This attribute is required. Set a value to save.')).toBeVisible();
            expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBe(
                optionId(program, 'AURORA'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify unarchiving from Channel Configuration needs every
     * required attribute set first, since its editor is on the same page.
     */
    test('refuses to unarchive until required values are set', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await getAdminClient();
        if (!adminUser || !adminClient) {
            throw new Error('Admin user/client not available');
        }
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const {team} = await pw.initSetup();
            const channel = await createChannelForAttributes(adminClient, team, `sysconsole-unarchive-${suffix}`);
            await adminClient.deleteChannel(channel.id);

            // Archived channels are not backfilled, so this one has no value.
            const program = await createAttribute(adminClient, attributeName('program', suffix), {
                type: 'select',
                options: ['AURORA', 'ZEPHYR'],
                required: true,
            });
            created.push(program);

            const {page} = await pw.testBrowser.login(adminUser);
            await page.goto(`/admin_console/user_management/channels/${channel.id}`);

            // # Unarchive without setting the value
            await page.getByRole('button', {name: 'Unarchive Channel'}).click();
            const trigger = page.getByTestId(`channelAttributesSettings-${program.name}`);
            await expect(trigger).toContainText('Not set');

            // * Save is disabled and the channel stays archived
            await expect(page.getByTestId('saveSetting')).toBeDisabled();
            await expect(page.getByText(/before saving\. This attribute is required\./)).toBeVisible();
            expect((await adminClient.getChannel(channel.id)).delete_at).not.toBe(0);

            // # Set the value and save
            await trigger.click();
            await page.getByText('ZEPHYR', {exact: true}).click();
            await page.getByTestId('saveSetting').click();

            // * The channel is unarchived with the value stored
            await expect(page).toHaveURL(/\/admin_console\/user_management\/channels$/);
            await expect.poll(async () => (await adminClient.getChannel(channel.id)).delete_at).toBe(0);
            expect(valueFor(await readChannelValues(adminClient, channel.id), program)).toBe(
                optionId(program, 'ZEPHYR'),
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
