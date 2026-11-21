// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {components, expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {
    deleteAttributes,
    optionId,
    purgeAttributes,
    readChannelValues,
    setChannelValue,
    valueFor,
} from '../channel_attributes/helpers';
import {
    REQUIRED_FIELD_TEST_TIMEOUT,
    expectMissingRequiredRefusal,
    setUpTeamMissingRequiredValue,
} from '../channel_attributes/missing_required_helpers';

async function adminClientOrThrow() {
    const {adminClient} = await getAdminClient();
    if (!adminClient) {
        throw new Error('Admin client not available');
    }
    return adminClient;
}

test.describe('Convert to private - required channel attributes', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify making a public channel private from Channel Settings asks for the missing required
     * value in the confirmation, keeps the confirm button disabled until it is picked, and leaves a private
     * channel that carries the value.
     */
    test('asks for the missing value in the confirmation and converts with it', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const adminClient = await adminClientOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, team, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );

            const {channelsPage} = await pw.testBrowser.login(creator);
            await channelsPage.goto(team.name, offTopic.name);
            await channelsPage.toBeVisible();

            // # Choose Private in Channel Settings -> Info and save
            const channelSettings = await channelsPage.openChannelSettings();
            const info = await channelSettings.openInfoTab();
            await info.selectPrivate();
            await info.save();

            // * The confirmation lists the missing field and holds the confirm button back
            const confirm = info.convertConfirmModal;
            await confirm.toBeVisible();
            await expect(confirm.attributes.row(field.name)).toBeVisible();
            await expect(confirm.confirmButton).toBeDisabled();

            // # Pick a value
            await confirm.attributes.select(field.name, 'AURORA');
            await expect(confirm.confirmButton).toBeEnabled();
            await confirm.confirm();

            // * The channel is private and carries the value
            await expect.poll(async () => (await adminClient.getChannel(offTopic.id)).type).toBe('P');
            expect(valueFor(await readChannelValues(adminClient, offTopic.id), field)).toBe(optionId(field, 'AURORA'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a channel that already has the required value is converted without the confirmation
     * asking for anything, and keeps its value.
     */
    test('asks nothing when the channel already has the value', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const adminClient = await adminClientOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {field, creator, team, offTopic} = await setUpTeamMissingRequiredValue(
                pw,
                adminClient,
                suffix,
                created,
            );
            await setChannelValue(adminClient, offTopic.id, field, optionId(field, 'ZEPHYR'));

            const {channelsPage} = await pw.testBrowser.login(creator);
            await channelsPage.goto(team.name, offTopic.name);
            await channelsPage.toBeVisible();

            // # Choose Private in Channel Settings -> Info and save
            const channelSettings = await channelsPage.openChannelSettings();
            const info = await channelSettings.openInfoTab();
            await info.selectPrivate();
            await info.save();

            // * The confirmation is the plain one: nothing asked, confirm enabled
            const confirm = info.convertConfirmModal;
            await confirm.toBeVisible();
            await expect(confirm.attributes.container).toHaveCount(0);
            await expect(confirm.confirmButton).toBeEnabled();
            await confirm.confirm();

            // * The channel is private and the value is untouched
            await expect.poll(async () => (await adminClient.getChannel(offTopic.id)).type).toBe('P');
            expect(valueFor(await readChannelValues(adminClient, offTopic.id), field)).toBe(optionId(field, 'ZEPHYR'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a privacy change through the API without the required value is refused with a 400
     * and leaves the channel public.
     */
    test('refuses an API privacy change without the required value', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

        const adminClient = await adminClientOrThrow();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            const {offTopic} = await setUpTeamMissingRequiredValue(pw, adminClient, suffix, created);

            // * The server refuses the change without a value
            await expectMissingRequiredRefusal(() => adminClient.updateChannelPrivacy(offTopic.id, 'P'));

            // * The channel is still public
            expect((await adminClient.getChannel(offTopic.id)).type).toBe('O');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the System Console channel page converts a channel to private when the missing
     * value is filled on the page itself: the confirmation asks nothing more and the channel ends up
     * private with that value.
     */
    test('converts from the System Console page using the value filled on the page', async ({pw}) => {
        test.setTimeout(REQUIRED_FIELD_TEST_TIMEOUT);
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
            const {field, offTopic} = await setUpTeamMissingRequiredValue(pw, adminClient, suffix, created);

            const {page} = await pw.testBrowser.login(adminUser);
            await page.goto(`/admin_console/user_management/channels/${offTopic.id}`);

            // # Fill the missing value in the page's own Channel attributes section
            // The open menu's items reuse this test id, so the trigger is scoped to its row.
            const trigger = page
                .getByTestId(`channelAttributesSettingsRow-${field.name}`)
                .getByTestId(`channelAttributesSettings-${field.name}`);
            await expect(trigger).toBeVisible();
            await trigger.click();
            await page.getByText('AURORA', {exact: true}).click();
            await expect(page.getByRole('menu')).toHaveCount(0);
            await expect(trigger).toContainText('AURORA');

            // # Switch the channel to private and save
            await page.getByTestId('allow-all-toggle-private').click();
            await page.getByTestId('saveSetting').click();

            // * The confirmation asks for nothing more
            const confirm = new components.ConvertPrivateConfirmModal(page.locator('#confirmModal'));
            await confirm.toBeVisible();
            await expect(confirm.attributes.container).toHaveCount(0);
            await confirm.confirm();
            await expect(page).toHaveURL(/\/admin_console\/user_management\/channels$/);

            // * The channel is private and carries the value from the page
            await expect.poll(async () => (await adminClient.getChannel(offTopic.id)).type).toBe('P');
            expect(valueFor(await readChannelValues(adminClient, offTopic.id), field)).toBe(optionId(field, 'AURORA'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});
