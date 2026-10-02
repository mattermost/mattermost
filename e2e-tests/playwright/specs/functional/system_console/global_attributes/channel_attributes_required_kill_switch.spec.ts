// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The ChannelAttributesRequired feature flag.
 *
 * Ops can flip this flag to enable required-attribute enforcement without a
 * redeploy. These specs cover the two surfaces the flag actually changes:
 * whether the create-channel dialog asks for a value, and whether the System
 * Console offers the Required toggle at all.
 */

import type {Client4} from '@mattermost/client';

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {configureChannelAttribute, deleteChannelFieldIfExists} from './applies_to_helpers';
import {deleteGlobalAttributeFieldIfExists, requireGlobalAttributesEnabled} from './global_attributes_helpers';

async function setChannelAttributesRequired(adminClient: Client4, enabled: boolean) {
    await adminClient.patchConfig({
        FeatureFlags: {
            ChannelAttributesRequired: enabled,
        },
    } as any);
}

test.describe(
    'System Console - ChannelAttributesRequired feature flag',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        // Shares the server-wide GlobalAttributes/ChannelAttributes flags with the
        // sibling channel_resource_configuration spec.
        test.describe.configure({mode: 'serial'});

        test.afterEach(async () => {
            // Belt-and-suspenders: always restore flag to default (false = off)
            // so a later spec file doesn't inherit enforcement being on.
            const {adminClient} = await getAdminClient();
            await setChannelAttributesRequired(adminClient, false);
        });

        /**
         * @objective Ensure that with ChannelAttributesRequired off, a channel field
         * already marked required is hidden from the create-channel dialog and no
         * longer blocks creation — mirroring the QA scenario where the field was
         * configured while enforcement was on, and ops later disables enforcement.
         */
        test('creating a channel succeeds with no value for a required attribute when ChannelAttributesRequired is off', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            let name = '';

            try {
                // # Enable enforcement so the Required toggle is visible, allowing
                // # the attribute to be configured as required via the UI.
                await setChannelAttributesRequired(adminClient, true);
                await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequired', true);

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                name = await configureChannelAttribute(
                    systemConsolePage,
                    {
                        displayName: `Required ${suffix}`,
                        type: 'Select',
                        options: ['ALPHA'],
                        required: true,
                        displayLocations: ['display_label_header'],
                    },
                    adminClient,
                );

                // # Ops disables enforcement after the fact (e.g. mobile rollout issue)
                await setChannelAttributesRequired(adminClient, false);
                await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequired', false);

                // # A fresh session picks up the new config
                const {team} = await pw.initSetup();
                const {channelsPage} = await pw.testBrowser.login(adminUser);
                await channelsPage.goto(team.name);
                await channelsPage.toBeVisible();

                const displayName = `Attr Required ${suffix}`;
                const modal = await channelsPage.openNewChannelModal();

                // * The field is not offered — enforcement is off, so asking for it
                // * would be misleading
                await expect(channelsPage.page.getByTestId(`channelAttributeRow-${name}`)).toHaveCount(0);

                // # Create the channel with no value for the (still nominally required) attribute
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
         * @objective Ensure the System Console shows the Required toggle for a
         * channel-resource attribute when ChannelAttributesRequired is on, and hides
         * it when the flag is off (no admin path to freshly mark a field required
         * while enforcement is disabled).
         */
        test('shows the Required toggle for channel attributes when ChannelAttributesRequired is on, hides it when off', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();

            // # Enable enforcement before opening the New attribute form
            await setChannelAttributesRequired(adminClient, true);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequired', true);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await globalAttributes.gotoNewAttribute();
            await globalAttributes.setDisplayName(`Required Toggle ${suffix}`);
            await attributeAppliesToChannels.addResource();

            // * Required toggle is visible — enforcement is on
            await expect(attributeAppliesToChannels.requiredToggle).toBeVisible();

            // # Disable enforcement and load the form fresh
            await setChannelAttributesRequired(adminClient, false);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributesRequired', false);

            const {systemConsolePage: systemConsolePageAfter} = await pw.testBrowser.login(adminUser);
            const globalAttributesAfter = systemConsolePageAfter.globalAttributes;
            const attributeAppliesToChannelsAfter = globalAttributesAfter.attributeAppliesToChannels;

            await globalAttributesAfter.gotoNewAttribute();
            await globalAttributesAfter.setDisplayName(`Required Toggle Off ${suffix}`);
            await attributeAppliesToChannelsAfter.addResource();

            // * Required toggle hidden — enforcement is off, no admin path to mark required
            await expect(attributeAppliesToChannelsAfter.requiredToggle).toHaveCount(0);

            // Neither form was saved, so there is no attribute field to clean up.
        });
    },
);
