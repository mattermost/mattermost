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

import type {Channel} from '@mattermost/types/channels';

import {expect, getAdminClient, runCleanups, test} from '@mattermost/playwright-lib';

import {
    attributeName,
    backfillChannelAttribute,
    createAttribute,
    deleteAttributes,
    optionId as attributeOptionId,
    purgeAttributes,
} from '../../channels/channel_attributes/helpers';

import {
    addChannelResource,
    attributesPath,
    openNewAttribute,
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from './global_attributes_helpers';
import {
    archiveChannels,
    createChannelAttributeField,
    createComplianceChannel,
    deleteChannelAttributeField,
    fieldName,
    getChannelPropertyField,
    openAttributeChannelSettings,
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

        // What a test created, removed after it whether it passed or not, newest first.
        const cleanups: Array<() => Promise<unknown>> = [];

        test.beforeAll(async () => {
            const {adminClient} = await getAdminClient();
            const {FeatureFlags} = await adminClient.getConfig();
            originalGlobalAttributes = FeatureFlags.GlobalAttributes === true;
        });

        test.afterEach(async () => {
            await runCleanups(cleanups);
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
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('blocked', suffix), {
                options: ['Value A'],
                displayName: `Blocked ${suffix}`,
            });
            cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
            const channel = await createComplianceChannel(adminClient, team, suffix);
            cleanups.push(() => archiveChannels(adminClient, [channel]));

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, pair.templateField.id);

            // * The banner explains why, before any click
            await expect(settings.missingValuesBanner).toBeVisible();
            await expect(settings.missingValuesBanner).toContainText('Set channel attribute values');
            await expect(settings.missingValuesBanner.viewListButton).toBeVisible();
            await expect(settings.missingValuesBanner.notifyButton).toBeVisible();

            // # Click Required while blocked
            await settings.requiredSwitch.toggle();

            // * It did not flip
            await expect(settings.requiredSwitch).not.toBeOn();
            // * The banner is still there to explain why
            await expect(settings.missingValuesBanner).toBeVisible();

            // # The blocked click did not break the page: an unrelated edit still saves
            await settings.location('display_label_header').check();
            await app.admin.saveButton.click();
            await expect(app.page).toHavePath(attributesPath(app));

            const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
            expect(reloaded.attrs?.required).not.toBe(true);
            expect(reloaded.attrs?.actions).toEqual(['display_label_header']);
        });

        /**
         * @objective Verify turning Required off always works while channels are
         * missing values -- the escape hatch for a field that started required.
         */
        test('always allows turning Required off, even while channels are missing values', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const channel = await createComplianceChannel(adminClient, team, suffix);
            await adminClient.deleteChannel(channel.id);

            const pair = await createChannelAttributeField(adminClient, fieldName('escape', suffix), {
                options: ['Value A'],
                required: true,
                displayName: `Escape ${suffix}`,
            });
            cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
            await adminClient.unarchiveChannel(channel.id);
            cleanups.push(() => archiveChannels(adminClient, [channel]));

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, pair.templateField.id);

            await expect(settings.requiredSwitch).toBeOn();
            await expect(settings.missingValuesBanner).toBeVisible();

            await settings.requiredSwitch.set(false);
            await expect(settings.requiredSwitch).not.toBeOn();

            await app.admin.saveButton.click();
            await expect(app.page).toHavePath(attributesPath(app));

            const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
            expect(reloaded.attrs?.required).not.toBe(true);
        });

        /**
         * @objective Verify create mode (no field ID yet) hides both Notify and View
         * channel list -- nothing can have a value for a field that doesn't exist
         * yet, so a notified admin would have nothing to set, and the list would
         * just be every active channel rather than a targeted one.
         */
        test('create mode hides both Notify and View channel list', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);
            await pw.initSetup();

            const {app} = await pw.testBrowser.login(adminUser);
            const form = await openNewAttribute(app);
            const displayName = fieldName('create_mode', suffix);
            await form.displayName.container.fill(displayName);
            await expect(form.displayName.container).toHaveValue(displayName);
            const settings = await addChannelResource(form);

            await expect(settings.missingValuesBanner).toBeVisible();
            await expect(settings.missingValuesBanner.viewListButton).not.toBeVisible();
            await expect(settings.missingValuesBanner.notifyButton).not.toBeVisible();
        });

        /**
         * @objective Verify View channel list surfaces the specific channel and admin
         * missing the value, links to its System Console detail page, and drops the
         * channel from the list once it is no longer missing.
         */
        test('View channel list finds the channel and its admin, and drops it once compliant', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team, user} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('list', suffix), {
                options: ['Value A'],
            });
            cleanups.push(() => deleteChannelAttributeField(adminClient, pair));

            // The modal pages 20 channels sorted by name, and channels left by earlier
            // specs would push this one off the first page, so backfill them first.
            await backfillChannelAttribute(adminClient, pair.channelField, optionId(pair.templateField, 'Value A'));

            const channel = await createComplianceChannel(adminClient, team, suffix, `Missing Value ${suffix}`);
            cleanups.push(() => archiveChannels(adminClient, [channel]));
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, pair.templateField.id);

            let modal = await settings.missingValuesBanner.viewListButton.clickTo(settings.channelsWithoutValueModal);
            const row = modal.channel(channel.id);
            await expect(row).toBeVisible();
            await expect(row).toContainText(`${user.first_name} ${user.last_name}`);
            await expect(row).toContainText(team.display_name);
            // * The link carries the site URL, so it keeps a subpath when there is one
            await expect(modal.channelLink(channel.id)).toHaveText(channel.display_name);
            await expect(modal.channelLink(channel.id).locator).toHaveAttribute(
                'href',
                new RegExp(`/admin_console/user_management/channels/${channel.id}$`),
            );
            await modal.footerCloseButton.click();
            await expect(modal).not.toBeVisible();

            // # Set the value directly via the API, then reopen the modal (a fresh
            // # mount, so it refetches rather than reusing a stale page).
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: pair.channelField.id, value: optionId(pair.templateField, 'Value A')},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            modal = await settings.missingValuesBanner.viewListButton.clickTo(settings.channelsWithoutValueModal);
            await expect(modal.channel(channel.id)).not.toBeVisible();
            await modal.footerCloseButton.click();
            await expect(modal).not.toBeVisible();
        });

        /**
         * @objective Verify Required becomes settable once every channel has a value.
         *
         * The missing-values scan is server-wide, so the test first backfills every
         * active local channel (without setting Required) to make the table fully
         * compliant regardless of what other specs left on the server.
         */
        test('once every channel has a value, Required can be turned on', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('compliant', suffix), {
                options: ['Value A'],
                displayName: `Compliant ${suffix}`,
            });
            cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
            const channel = await createComplianceChannel(adminClient, team, suffix);
            cleanups.push(() => archiveChannels(adminClient, [channel]));
            const value = optionId(pair.templateField, 'Value A');
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: pair.channelField.id, value},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            // Default channels (town-square, off-topic) from this and earlier specs'
            // initSetup teams stay active and have no value for a brand-new field,
            // so backfill them without setting Required.
            await backfillChannelAttribute(adminClient, pair.channelField, value);

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, pair.templateField.id);

            const summary = await adminClient.getChannelAttributeComplianceSummary(
                'access_control',
                pair.channelField.id,
            );
            expect(summary.missing_channel_count).toBe(0);
            await expect(settings.missingValuesBanner).not.toBeVisible();

            await settings.requiredSwitch.set(true);
            await expect(settings.requiredSwitch).toBeOn();

            await app.admin.saveButton.click();
            await expect(app.page).toHavePath(attributesPath(app));

            const reloaded = await getChannelPropertyField(adminClient, pair.channelField.id);
            expect(reloaded.attrs?.required).toBe(true);
        });

        /**
         * @objective Verify a channel attribute created on channels directly (no
         * template) is edited as the saved attribute it is: the banner counts its
         * own channels and offers Notify and View channel list, rather than the
         * create-mode copy that asks to save it first.
         */
        test('a standalone channel attribute is edited as itself, not as an unsaved one', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeAttributes(adminClient);

            const {team} = await pw.initSetup();
            const field = await createAttribute(adminClient, attributeName('standalone', suffix), {
                type: 'select',
                options: ['Value A'],
            });
            cleanups.push(() => deleteAttributes(adminClient, [field]));

            // Keeps this channel on the modal's first page; see the View channel list test.
            await backfillChannelAttribute(adminClient, field, attributeOptionId(field, 'Value A'));

            const channel = await createComplianceChannel(adminClient, team, suffix, `Standalone Missing ${suffix}`);
            cleanups.push(() => archiveChannels(adminClient, [channel]));

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, field.id);

            // * The banner treats the attribute as saved: no create-mode copy, both actions offered
            await expect(settings.missingValuesBanner).toBeVisible();
            await expect(settings.missingValuesBanner).not.toContainText('Save this attribute first');
            await expect(settings.missingValuesBanner.notifyButton).toBeVisible();
            await expect(settings.missingValuesBanner.viewListButton).toBeVisible();

            // * The list is this attribute's own: the channel is in it until it has a value
            let modal = await settings.missingValuesBanner.viewListButton.clickTo(settings.channelsWithoutValueModal);
            await expect(modal.channel(channel.id)).toBeVisible();
            await modal.footerCloseButton.click();
            await expect(modal).not.toBeVisible();

            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: field.id, value: attributeOptionId(field, 'Value A')},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            modal = await settings.missingValuesBanner.viewListButton.clickTo(settings.channelsWithoutValueModal);
            await expect(modal.channel(channel.id)).not.toBeVisible();
            await modal.footerCloseButton.click();
            await expect(modal).not.toBeVisible();
        });

        /**
         * @objective Verify an attribute that is already Required can be switched off
         * and back on before saving: only a saved off -> on is refused, so undoing an
         * unsaved change is not blocked and does not raise the warning.
         */
        test('an already-required attribute can be turned off and back on before saving', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const channel = await createComplianceChannel(adminClient, team, suffix);
            await adminClient.deleteChannel(channel.id);

            const pair = await createChannelAttributeField(adminClient, fieldName('undo', suffix), {
                options: ['Value A'],
                required: true,
            });
            cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
            await adminClient.unarchiveChannel(channel.id);
            cleanups.push(() => archiveChannels(adminClient, [channel]));

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, pair.templateField.id);

            // * Saved Required, with the already-required copy
            await expect(settings.requiredSwitch).toBeOn();
            await expect(settings.missingValuesBanner).toContainText('New channels must set one');

            // # Off, then back on, without saving
            await settings.requiredSwitch.toggle();
            await expect(settings.requiredSwitch).not.toBeOn();
            await settings.requiredSwitch.toggle();

            // * Back on, and nothing was refused
            await expect(settings.requiredSwitch).toBeOn();
            // The banner turns into a warning only through a CSS class, which has no ARIA state.
            await expect(settings.missingValuesBanner.container.locator).not.toHaveClass(/warning/);
            await expect(settings.missingValuesBanner).toContainText('New channels must set one');
        });

        /**
         * @objective Verify View channel list pages through every channel missing a
         * value: Previous and Next are shown with Close, Next reaches past the first
         * 20, and on the last page Next is disabled rather than opening an empty page.
         */
        test('View channel list pages past the first 20 channels', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();
            await purgeRequiredGateFields(adminClient);

            const {team} = await pw.initSetup();
            const pair = await createChannelAttributeField(adminClient, fieldName('paging', suffix), {
                options: ['Value A'],
            });
            cleanups.push(() => deleteChannelAttributeField(adminClient, pair));

            // The count is server-wide; these 21 guarantee more than one page.
            const pagingChannels: Channel[] = [];
            cleanups.push(() => archiveChannels(adminClient, pagingChannels));
            for (let i = 0; i < 21; i++) {
                pagingChannels.push(
                    await createComplianceChannel(adminClient, team, `${suffix}p${i}`, `Paging ${suffix} ${i}`),
                );
            }

            const {app} = await pw.testBrowser.login(adminUser);
            const settings = await openAttributeChannelSettings(app, pair.templateField.id);

            const modal = await settings.missingValuesBanner.viewListButton.clickTo(settings.channelsWithoutValueModal);

            // * The pager is shown alongside Close
            await expect(modal.footerCloseButton).toBeVisible();
            await expect(modal.channelList).toHaveKeyCount(20);
            await expect(modal.previousButton).toBeDisabled();
            await expect(modal.nextButton).toBeEnabled();

            const header = await modal.headingText.text();
            const total = Number(header.match(/(\d+) channels? still need/)?.[1]);
            expect(total).toBeGreaterThan(20);
            const lastPage = Math.ceil(total / 20) - 1;
            const [firstKey] = await modal.channelList.keys();

            // # Page forward to the last page. Previous enabling marks each page loaded.
            for (let p = 1; p <= lastPage; p++) {
                await modal.nextButton.click();
                await expect(modal.previousButton).toBeEnabled();
            }

            // * The last page has its remaining rows, and Next stops there
            await expect(modal.channelList).toHaveKeyCount(total - lastPage * 20);
            await expect(modal.channelList).not.toContainKeys([firstKey]);
            await expect(modal.nextButton).toBeDisabled();

            await modal.footerCloseButton.click();
            await expect(modal).not.toBeVisible();
        });
    },
);
