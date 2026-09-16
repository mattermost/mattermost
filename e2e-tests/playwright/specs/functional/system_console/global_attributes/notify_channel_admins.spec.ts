// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — "Notify all channel admins" (MM-70717).
 *
 * The one part of this feature not worth much as a unit test and everything
 * as an end-to-end one: does a real message land in a real inbox. Delivery is
 * asynchronous (fired via a background goroutine on the server), so
 * assertions on the resulting DM poll rather than check immediately.
 */

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled, setGlobalAttributesFeatureFlag} from './global_attributes_helpers';
import {
    ATTRIBUTE_DETAILS_PATH,
    createChannelAttributeField,
    createComplianceChannel,
    deleteChannelAttributeField,
    fieldName,
    purgeRequiredGateFields,
} from './required_gate_helpers';

const SYSTEM_BOT_USERNAME = 'system-bot';

test.describe('System Console - notify all channel admins', {tag: ['@system_console', '@channel_attributes']}, () => {
    // Shares the server-wide GlobalAttributes flag with the sibling specs.
    test.describe.configure({mode: 'serial'});

    let originalGlobalAttributes: boolean | undefined;

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        const {FeatureFlags} = await adminClient.getConfig();
        originalGlobalAttributes = FeatureFlags.GlobalAttributes === true;
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient();
        if (adminClient && originalGlobalAttributes !== undefined) {
            await setGlobalAttributesFeatureFlag(adminClient, originalGlobalAttributes);
        }
    });

    /**
     * @objective Verify confirming Notify actually delivers a DM from the System
     * Bot to the channel's admin, naming the channel.
     */
    test('confirming Notify sends a real DM to the channel admin', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_happy', suffix), {
            options: ['Value A'],
        });
        const channel = await createComplianceChannel(adminClient, team, suffix, `Notify Channel ${suffix}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page, globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
            await expect(globalAttributes.displayNameInput).toBeVisible();
            await attributeAppliesToChannels.expand();

            const modal = await attributeAppliesToChannels.openNotifyChannelAdminsModal();
            await expect(modal.messagePreview).not.toHaveText('');
            await modal.confirm();

            // * The banner reflects a successful send
            await expect(attributeAppliesToChannels.missingValuesBanner).toContainText('Notified');

            // # Switch to the channel admin's own session and check their DM inbox
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, `@${SYSTEM_BOT_USERNAME}`);

            // * A real DM arrived from the System Bot, naming the channel
            await expect(channelsPage.centerView.postViews.filter({hasText: channel.display_name})).toBeVisible({
                timeout: 15000,
            });
        } finally {
            await deleteChannelAttributeField(adminClient, pair);
        }
    });

    /**
     * @objective Verify cancelling the confirmation sends nothing.
     */
    test('cancelling the confirmation sends nothing', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_cancel', suffix), {
            options: ['Value A'],
        });
        const channel = await createComplianceChannel(adminClient, team, suffix, `Notify Cancel Channel ${suffix}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page, globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
            await expect(globalAttributes.displayNameInput).toBeVisible();
            await attributeAppliesToChannels.expand();

            const modal = await attributeAppliesToChannels.openNotifyChannelAdminsModal();
            await modal.cancel();

            // # Cancelling has no positive signal to wait on; give the (nonexistent)
            // # async send a moment before asserting absence.
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, `@${SYSTEM_BOT_USERNAME}`);
            await channelsPage.page.waitForTimeout(3000);

            // * No DM arrived
            await expect(channelsPage.centerView.postViews.filter({hasText: channel.display_name})).toHaveCount(0);
        } finally {
            await deleteChannelAttributeField(adminClient, pair);
        }
    });

    /**
     * @objective Verify the confirmation calls out channels with no channel admin
     * instead of silently dropping them.
     */
    test('the confirmation calls out channels with no channel admin', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_no_admin', suffix), {
            options: ['Value A'],
        });

        const channelWithAdmin = await createComplianceChannel(adminClient, team, `${suffix}a`, `Has Admin ${suffix}`);
        await adminClient.addToChannel(user.id, channelWithAdmin.id);
        await adminClient.updateChannelMemberSchemeRoles(channelWithAdmin.id, user.id, true, true);

        // The creator (adminUser) is always made a channel admin on creation --
        // demote them so this channel genuinely has none.
        const channelNoAdmin = await createComplianceChannel(adminClient, team, `${suffix}b`, `No Admin ${suffix}`);
        await adminClient.updateChannelMemberSchemeRoles(channelNoAdmin.id, adminUser.id, true, false);

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page, globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
            await expect(globalAttributes.displayNameInput).toBeVisible();
            await attributeAppliesToChannels.expand();

            const modal = await attributeAppliesToChannels.openNotifyChannelAdminsModal();

            // * The no-admin channel is called out, not silently dropped
            await expect(modal.container).toContainText("no channel admin and won't be notified");

            await modal.confirm();
        } finally {
            await deleteChannelAttributeField(adminClient, pair);
        }
    });
});
