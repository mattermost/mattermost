// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The ChannelAttributesRequiredDisabled kill switch.
 *
 * Ops can flip this flag to make required-attribute enforcement inert without a
 * redeploy (e.g. mobile cannot yet supply required values at creation time).
 * These specs cover the two surfaces the switch actually changes: whether the
 * create-channel dialog asks for a value, and whether the System Console still
 * offers the Required toggle at all while the switch is engaged.
 */

import type {Client4} from '@mattermost/client';

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {configureChannelAttribute, deleteChannelFieldIfExists} from './applies_to_helpers';
import {deleteGlobalAttributeFieldIfExists, requireGlobalAttributesEnabled} from './global_attributes_helpers';

async function setRequiredEnforcementKillSwitch(adminClient: Client4, enabled: boolean) {
    await adminClient.patchConfig({
        FeatureFlags: {
            ChannelAttributesRequiredDisabled: enabled,
        },
    } as any);
}

test.describe(
    'System Console - ChannelAttributesRequiredDisabled kill switch',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        // Shares the server-wide GlobalAttributes/ChannelAttributes flags with the
        // sibling channel_resource_configuration spec.
        test.describe.configure({mode: 'serial'});

        test.afterEach(async () => {
            // Belt-and-suspenders: never leave the kill switch engaged for a later
            // spec file, even if an assertion above threw mid-test.
            const {adminClient} = await getAdminClient();
            await setRequiredEnforcementKillSwitch(adminClient, false);
        });

        /**
         * @objective Ensure that with the kill switch engaged, a channel field already
         * marked required is hidden from the create-channel dialog and no longer
         * blocks creation — mirroring the QA scenario where the field was configured
         * before an incident, and ops disables enforcement afterward.
         */
        test('creating a channel succeeds with no value for a required attribute once the kill switch is on', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            let name = '';

            try {
                // # Configure a required channel attribute the normal way, kill switch
                // still off — this is the field an admin set up before any incident.
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                name = await configureChannelAttribute(systemConsolePage, {
                    displayName: `Killswitch ${suffix}`,
                    type: 'Select',
                    options: ['ALPHA'],
                    required: true,
                    displayLocations: ['display_label_header'],
                });

                // # Ops engages the kill switch after the fact
                await setRequiredEnforcementKillSwitch(adminClient, true);
                await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequiredDisabled', true);

                // # A fresh session picks up the new config
                const {team} = await pw.initSetup();
                const {channelsPage} = await pw.testBrowser.login(adminUser);
                await channelsPage.goto(team.name);
                await channelsPage.toBeVisible();

                const displayName = `Attr Killswitch ${suffix}`;
                const modal = await channelsPage.openNewChannelModal();

                // * The field is no longer offered: nothing enforces it while the
                // * switch is engaged, so asking for it would be misleading
                await expect(channelsPage.page.getByTestId(`channelAttributeRow-${name}`)).toHaveCount(0);

                // # Create the channel with no value for the (still nominally
                // # required) attribute
                await modal.fillDisplayName(displayName);
                await modal.create();

                // * Creation succeeds — the modal closes with no validation error
                await expect(modal.container).not.toBeVisible();
                const channel = await adminClient.getChannelByName(
                    team.id,
                    displayName.toLowerCase().replace(/\s+/g, '-'),
                );
                expect(channel).toBeDefined();
            } finally {
                await deleteChannelFieldIfExists(adminClient, name);
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure the System Console hides the Required toggle for a
         * channel-resource attribute entirely while the kill switch is engaged (there
         * is no admin path to freshly mark one required during that window), and that
         * the toggle comes back once the switch is disengaged again.
         */
        test('hides the Required toggle for channel attributes while the kill switch is on, and restores it when off', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();

            // # Engage the kill switch before opening the New attribute form
            await setRequiredEnforcementKillSwitch(adminClient, true);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequiredDisabled', true);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await globalAttributes.gotoNewAttribute();
            await globalAttributes.setDisplayName(`Killswitch Toggle ${suffix}`);
            await attributeAppliesToChannels.addResource();

            // * No admin path to mark it required while the switch is engaged
            await expect(attributeAppliesToChannels.requiredToggle).toHaveCount(0);

            // # Disengage the switch and load the form fresh
            await setRequiredEnforcementKillSwitch(adminClient, false);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequiredDisabled', false);

            const {systemConsolePage: systemConsolePageAfter} = await pw.testBrowser.login(adminUser);
            const globalAttributesAfter = systemConsolePageAfter.globalAttributes;
            const attributeAppliesToChannelsAfter = globalAttributesAfter.attributeAppliesToChannels;

            await globalAttributesAfter.gotoNewAttribute();
            await globalAttributesAfter.setDisplayName(`Killswitch Toggle Restored ${suffix}`);
            await attributeAppliesToChannelsAfter.addResource();

            // * The toggle is back, confirming it works both ways
            await expect(attributeAppliesToChannelsAfter.requiredToggle).toBeVisible();

            // Neither form was saved, so there is no attribute field to clean up.
        });
    },
);
