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

import {Api, expect, getAdminClient, postWith, runCleanups, settle, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled, setGlobalAttributesFeatureFlag} from './global_attributes_helpers';
import {
    createChannelAttributeField,
    createComplianceChannel,
    deleteChannelAttributeField,
    fieldName,
    openAttributeChannelSettings,
    purgeRequiredGateFields,
    systemBotMessagesAbout,
} from './required_gate_helpers';

const SYSTEM_BOT_HANDLE = '@system-bot';

test.describe('System Console - notify all channel admins', {tag: ['@system_console', '@channel_attributes']}, () => {
    // Shares the server-wide GlobalAttributes flag with the sibling specs.
    test.describe.configure({mode: 'serial'});

    let originalGlobalAttributes: boolean | undefined;

    // What a test created, removed after it whether it passed or not.
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
     * @objective Verify confirming Notify actually delivers a DM from the System
     * Bot to the channel's admin, naming the channel.
     */
    test('confirming Notify sends a real DM to the channel admin', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_happy', suffix), {
            options: ['Value A'],
        });
        cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
        const channel = await createComplianceChannel(adminClient, team, suffix, `Notify Channel ${suffix}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

        const {app} = await pw.testBrowser.login(adminUser);
        let settings = await openAttributeChannelSettings(app, pair.templateField.id);

        const modal = await settings.missingValuesBanner.notifyButton.clickTo(settings.notifyChannelAdminsModal);

        // * Before Required is on, the preview asks for a value rather than calling it required
        await expect(modal.previewText).toContainText('on these channels you manage');
        await settle(modal.confirmButton, {wait: Api.NotifyChannelAdminsOfMissingAttributeValue}).click();
        await expect(modal).not.toBeVisible();

        // * The banner reflects a successful send
        await expect(settings.missingValuesBanner).toContainText('Notification queued');

        // # Come back to the page and notify again right away
        settings = await openAttributeChannelSettings(app, pair.templateField.id);
        await settings.missingValuesBanner.notifyButton.click();

        // * No confirmation opens; the banner says when another one can go out
        await expect(settings.missingValuesBanner).toContainText('You can send another notification in');
        await expect(settings.notifyChannelAdminsModal).not.toBeVisible();

        // # Switch to the channel admin's own session and check their DM inbox
        const {app: userApp} = await pw.testBrowser.login(user);
        await userApp.channelsPage.goto({team, path: 'messages', channel: SYSTEM_BOT_HANDLE});

        // * A real DM arrived from the System Bot, naming the channel, with the same text as the preview
        const dm = await postWith(userApp.center.postList, {text: channel.display_name}, {timeout: 15000});
        await expect(dm).toContainText('on these channels you manage');
    });

    /**
     * @objective Verify cancelling the confirmation sends nothing.
     */
    test('cancelling the confirmation sends nothing', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_cancel', suffix), {
            options: ['Value A'],
        });
        cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
        const channel = await createComplianceChannel(adminClient, team, suffix, `Notify Cancel Channel ${suffix}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

        const {app} = await pw.testBrowser.login(adminUser);

        // The DM send only ever starts server-side in response to this POST, so
        // its absence is what proves nothing can still be in flight.
        const notifyRequests: string[] = [];
        app.page.on('request', (request) => {
            if (request.method() === 'POST' && request.url().endsWith('/missing_values/notify')) {
                notifyRequests.push(request.url());
            }
        });

        const settings = await openAttributeChannelSettings(app, pair.templateField.id);

        const modal = await settings.missingValuesBanner.notifyButton.clickTo(settings.notifyChannelAdminsModal);
        await modal.cancelButton.click();
        await expect(modal).not.toBeVisible();

        // * No notify request left the browser
        expect(notifyRequests).toHaveLength(0);

        // * No DM exists
        expect(await systemBotMessagesAbout(adminClient, user, channel.display_name)).toEqual([]);
    });

    /**
     * @objective Verify the confirmation calls out channels with no channel admin
     * instead of silently dropping them.
     */
    test('the confirmation calls out channels with no channel admin', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_no_admin', suffix), {
            options: ['Value A'],
        });
        cleanups.push(() => deleteChannelAttributeField(adminClient, pair));

        const channelWithAdmin = await createComplianceChannel(adminClient, team, `${suffix}a`, `Has Admin ${suffix}`);
        await adminClient.addToChannel(user.id, channelWithAdmin.id);
        await adminClient.updateChannelMemberSchemeRoles(channelWithAdmin.id, user.id, true, true);

        // The creator (adminUser) is always made a channel admin on creation --
        // demote them so this channel genuinely has none.
        const channelNoAdmin = await createComplianceChannel(adminClient, team, `${suffix}b`, `No Admin ${suffix}`);
        await adminClient.updateChannelMemberSchemeRoles(channelNoAdmin.id, adminUser.id, true, false);

        const {app} = await pw.testBrowser.login(adminUser);
        const settings = await openAttributeChannelSettings(app, pair.templateField.id);

        const modal = await settings.missingValuesBanner.notifyButton.clickTo(settings.notifyChannelAdminsModal);

        // * The no-admin channel is called out, not silently dropped
        await expect(modal).toContainText(/no channel admin and (isn't|aren't) notified/);

        await settle(modal.confirmButton, {wait: Api.NotifyChannelAdminsOfMissingAttributeValue}).click();
        await expect(modal).not.toBeVisible();
    });

    /**
     * @objective Verify the notify preview and the DM name the attribute by its display
     * name -- taken from the template when the linked channel field has none of its
     * own -- and that the preview shows the formatted message, not its markdown.
     */
    test('names the attribute by its display name in the preview and the DM', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const suffix = pw.random.id();
        await purgeRequiredGateFields(adminClient);

        const displayName = `Data Owner ${suffix}`;
        const {team, user} = await pw.initSetup();
        const pair = await createChannelAttributeField(adminClient, fieldName('notify_name', suffix), {
            options: ['Value A'],
            displayName,
        });
        cleanups.push(() => deleteChannelAttributeField(adminClient, pair));
        const channel = await createComplianceChannel(adminClient, team, suffix, `Notify Name Channel ${suffix}`);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);

        const {app} = await pw.testBrowser.login(adminUser);
        const settings = await openAttributeChannelSettings(app, pair.templateField.id);

        const modal = await settings.missingValuesBanner.notifyButton.clickTo(settings.notifyChannelAdminsModal);

        // * The preview names the display name, rendered bold rather than as **markdown**
        // The preview is rendered markdown, whose bold has no generated part.
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- rendered markdown has no generated part for bold text
        await expect(modal.previewText.locator.locator('strong')).toHaveText(displayName);
        await expect(modal.previewText).not.toContainText('**');
        await expect(modal.previewText).not.toContainText(pair.channelField.name);

        await settle(modal.confirmButton, {wait: Api.NotifyChannelAdminsOfMissingAttributeValue}).click();
        await expect(modal).not.toBeVisible();
        await expect(settings.missingValuesBanner).toContainText('Notification queued');

        // * The DM the channel admin receives names the display name too
        await expect
            .poll(async () => (await systemBotMessagesAbout(adminClient, user, channel.display_name)).join('\n'), {
                timeout: 15000,
            })
            .toContain(`**${displayName}**`);
    });
});
