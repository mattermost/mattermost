// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — the required-channel-attribute compliance gate (MM-70717).
 *
 * Marking a channel attribute Required is blocked while any active channel on
 * the server lacks a value for it. The toggle itself never visually disables:
 * a blocked click reveals the missing-values banner instead of flipping it,
 * and turning Required back off always works regardless of channel state.
 *
 * Every scenario here seeds its own template+linked-channel-field pair via
 * the API (see required_gate_helpers.ts) rather than driving the "New
 * attribute" create flow through the UI for setup — that flow is already
 * covered by channel_resource_configuration.spec.ts. This file is only about
 * what happens once such a field already exists and is edited.
 */

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled, setGlobalAttributesFeatureFlag} from './global_attributes_helpers';
import {
    ATTRIBUTE_DETAILS_PATH,
    GLOBAL_ATTRIBUTES_PATH,
    createChannelAttributeField,
    createComplianceChannel,
    deleteChannelAttributeField,
    fieldName,
    getChannelPropertyField,
    optionId,
    purgeRequiredGateFields,
} from './required_gate_helpers';

test.describe(
    'System Console - the required-channel-attribute gate',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
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
         * @objective Verify a blocked click on Required does not flip it, reveals the
         * missing-values banner instead, and leaves the rest of the page usable.
         */
        test('does not flip Required while a channel lacks a value, and the page stays usable', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('blocked', suffix), {
                options: ['Value A'],
            });
            await createComplianceChannel(adminClient, team, suffix);

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;
                const {attributeAppliesToChannels} = globalAttributes;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await attributeAppliesToChannels.expand();

                // * The banner explains why, before any click
                await expect(attributeAppliesToChannels.missingValuesBanner).toBeVisible();
                await expect(attributeAppliesToChannels.missingValuesBanner).toContainText(
                    'Set channel attribute values',
                );
                await expect(attributeAppliesToChannels.viewChannelListButton).toBeVisible();
                await expect(attributeAppliesToChannels.notifyChannelAdminsButton).toBeVisible();

                // # Click Required while blocked
                await attributeAppliesToChannels.requiredToggle.click();

                // * It did not flip
                await expect(attributeAppliesToChannels.requiredToggle).not.toBeChecked();
                // * The banner is still there to explain why
                await expect(attributeAppliesToChannels.missingValuesBanner).toBeVisible();

                // # The blocked click did not break the page: an unrelated edit still saves
                await attributeAppliesToChannels.setDisplayLocations(['display_label_header']);
                await globalAttributes.save();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_PATH}$`));

                const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
                expect(reloaded.attrs?.required).not.toBe(true);
                expect(reloaded.attrs?.actions).toEqual(['display_label_header']);
            } finally {
                await deleteChannelAttributeField(adminClient, pair);
            }
        });

        /**
         * @objective Verify turning Required off always works while channels are
         * missing values -- the escape hatch for a field that started required.
         */
        test('always allows turning Required off, even while channels are missing values', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const channel = await createComplianceChannel(adminClient, team, suffix);
            await adminClient.deleteChannel(channel.id);

            const pair = await createChannelAttributeField(adminClient, fieldName('escape', suffix), {
                options: ['Value A'],
                required: true,
            });
            await adminClient.unarchiveChannel(channel.id);

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;
                const {attributeAppliesToChannels} = globalAttributes;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await attributeAppliesToChannels.expand();

                await expect(attributeAppliesToChannels.requiredToggle).toBeChecked();
                await expect(attributeAppliesToChannels.missingValuesBanner).toBeVisible();

                await attributeAppliesToChannels.setRequired(false);
                await expect(attributeAppliesToChannels.requiredToggle).not.toBeChecked();

                await globalAttributes.save();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_PATH}$`));

                const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
                expect(reloaded.attrs?.required).not.toBe(true);
            } finally {
                await deleteChannelAttributeField(adminClient, pair);
            }
        });

        /**
         * @objective Verify create mode (no field ID yet) hides both Notify and View
         * channel list -- nothing can have a value for a field that doesn't exist
         * yet, so a notified admin would have nothing to set, and the list would
         * just be every active channel rather than a targeted one.
         */
        test('create mode hides both Notify and View channel list', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);
            await pw.initSetup();

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await globalAttributes.gotoNewAttribute();
            await globalAttributes.setDisplayName(fieldName('create_mode', suffix));
            await attributeAppliesToChannels.addResource();

            await expect(attributeAppliesToChannels.missingValuesBanner).toBeVisible();
            await expect(attributeAppliesToChannels.viewChannelListButton).toHaveCount(0);
            await expect(attributeAppliesToChannels.notifyChannelAdminsButton).toHaveCount(0);
        });

        /**
         * @objective Verify View channel list surfaces the specific channel and admin
         * missing the value, links to its System Console detail page, and drops the
         * channel from the list once it is no longer missing.
         */
        test('View channel list finds the channel and its admin, and drops it once compliant', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team, user} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('list', suffix), {
                options: ['Value A'],
            });
            const channel = await createComplianceChannel(adminClient, team, suffix, `Missing Value ${suffix}`);
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;
                const {attributeAppliesToChannels} = globalAttributes;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await attributeAppliesToChannels.expand();

                let modal = await attributeAppliesToChannels.openChannelsWithoutValueModal();
                const row = modal.row(channel.display_name);
                await expect(row).toBeVisible();
                await expect(row).toContainText(user.username);
                await expect(row.getByRole('link', {name: channel.display_name})).toHaveAttribute(
                    'href',
                    `/admin_console/user_management/channels/${channel.id}`,
                );
                await modal.close();

                // # Set the value directly via the API, then reopen the modal (a fresh
                // # mount, so it refetches rather than reusing a stale page).
                await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                    {field_id: pair.channelField.id, value: optionId(pair.templateField, 'Value A')},
                ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

                modal = await attributeAppliesToChannels.openChannelsWithoutValueModal();
                await expect(modal.row(channel.display_name)).toHaveCount(0);
                await modal.close();
            } finally {
                await deleteChannelAttributeField(adminClient, pair);
            }
        });

        /**
         * @objective Verify Required becomes settable once every channel has a value.
         *
         * Best-effort: the missing-values scan is server-wide, not scoped to this
         * test's own channels, so this only completes when the server this spec
         * runs against has no other channel lacking a value for a brand-new
         * field. On a long-lived, channel-polluted shared server that is not
         * guaranteed, so the test skips itself rather than asserting a false
         * failure -- see MM-70717's follow-up doc §11.2.3.
         */
        test('once every channel has a value, Required can be turned on', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('compliant', suffix), {
                options: ['Value A'],
            });
            const channel = await createComplianceChannel(adminClient, team, suffix);
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: pair.channelField.id, value: optionId(pair.templateField, 'Value A')},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page, globalAttributes} = systemConsolePage;
                const {attributeAppliesToChannels} = globalAttributes;

                await page.goto(`${ATTRIBUTE_DETAILS_PATH}/${pair.templateField.id}`);
                await expect(globalAttributes.displayNameInput).toBeVisible();
                await attributeAppliesToChannels.expand();

                const stillBlocked = await attributeAppliesToChannels.missingValuesBanner.isVisible();
                test.skip(
                    stillBlocked,
                    'Another active channel on this server already lacks a value for this brand-new field; ' +
                        'only testable on an otherwise fully-compliant channel table.',
                );

                await attributeAppliesToChannels.setRequired(true);
                await expect(attributeAppliesToChannels.requiredToggle).toBeChecked();

                await globalAttributes.save();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_PATH}$`));

                const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
                expect(reloaded.attrs?.required).toBe(true);
            } finally {
                await deleteChannelAttributeField(adminClient, pair);
            }
        });
    },
);
