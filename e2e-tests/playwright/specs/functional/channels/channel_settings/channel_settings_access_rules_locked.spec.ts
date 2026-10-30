// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Channel Settings → Membership Policy tab is read-only when the saved rule needs the
 *            Advanced (CEL) editor, and the server refuses channel admin writes to such a rule.
 * @reference MM-71104
 */

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {ChannelsPage, expect, getAdminClient, getRandomId, test} from '@mattermost/playwright-lib';

import {createPrivateChannel, enableABACConfig} from '../team_settings/helpers';
import {createUserAttributeField} from '../../system_console/abac/support';

// Run-unique text fields so other specs' Department/Location fields of other types don't collide.
const DEPT = `Dept${getRandomId()}`;
const LOC = `Loc${getRandomId()}`;

// OR across different attributes: the table editor can't represent it.
const advancedRule = () => `user.attributes.${DEPT} == "Sales" || user.attributes.${LOC} == "US"`;
const simpleRule = () => `user.attributes.${DEPT} == "Sales"`;

const ADVANCED_RULE_ERROR_ID = 'app.pap.save_policy.advanced_rule_requires_system_admin';
const LOCKED_NOTICE = "These rules use advanced logic and can't be edited here.";
const CONTACT_ADMIN = 'Contact a System Admin to change them.';

async function saveChannelRule(client: Client4, channel: Channel, expression: string) {
    return client.updateOrCreateAccessControlPolicy({
        id: channel.id,
        name: channel.display_name,
        type: 'channel',
        active: false,
        revision: 1,
        rules: [{actions: ['membership'], expression}],
        imports: [],
    });
}

async function getChannelRule(client: Client4, channelId: string): Promise<string | undefined> {
    const policy = await client.getAccessControlPolicy(channelId);
    return policy.rules.find((rule) => rule.actions?.includes('membership'))?.expression;
}

async function makeChannelAdmin(adminClient: Client4, channel: Channel, user: UserProfile) {
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.updateChannelMemberSchemeRoles(channel.id, user.id, true, true);
}

async function expectAdvancedRuleRejection(call: () => Promise<unknown>, because: string) {
    let error: {status_code?: number; server_error_id?: string} | undefined;
    try {
        await call();
    } catch (err) {
        error = err as typeof error;
    }
    expect(error, `expected the server to refuse: ${because}`).toBeDefined();
    expect(error?.status_code, because).toBe(403);
    expect(error?.server_error_id, because).toBe(ADVANCED_RULE_ERROR_ID);
}

async function openMembershipPolicyTab(channelsPage: ChannelsPage) {
    const channelSettings = await channelsPage.openChannelSettings();
    await channelSettings.container.getByTestId('access_rules-tab-button').click();

    const tab = channelSettings.container.locator('.ChannelSettingsModal__accessRulesTab');
    await expect(tab).toBeVisible({timeout: 10000});
    return {channelSettings, tab};
}

test.describe('Channel Settings - Membership Policy locked for Advanced rules', {tag: '@abac'}, () => {
    const fieldIds: string[] = [];

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        await enableABACConfig(adminClient);
        for (const name of [DEPT, LOC]) {
            const field = await createUserAttributeField(adminClient, name);
            fieldIds.push(field.id);
        }
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        for (const id of fieldIds.splice(0)) {
            await (adminClient as any)
                .doFetch(`${adminClient.getBaseRoute()}/custom_profile_attributes/fields/${id}`, {method: 'DELETE'})
                .catch(() => {});
        }
    });

    /**
     * @objective A channel admin sees the saved Advanced rule read-only, with no table editor to overwrite it.
     */
    test('MM-71104_c1 channel admin sees an Advanced rule locked with a Contact a System Admin notice', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, user, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Make the user a channel admin, then save an Advanced rule as system admin (the rule gates joins)
        const channel = await createPrivateChannel(adminClient, team.id);
        await makeChannelAdmin(adminClient, channel, user);
        await saveChannelRule(adminClient, channel, advancedRule());

        // # Open Channel Settings → Membership Policy as the channel admin
        const {page} = await pw.testBrowser.login(user);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        const {channelSettings, tab} = await openMembershipPolicyTab(channelsPage);

        // * The rule is shown read-only with the channel admin wording
        const locked = tab.getByTestId('channel-access-rules-locked-rules');
        await expect(locked).toBeVisible({timeout: 10000});
        await expect(locked.getByRole('status')).toHaveText(`${LOCKED_NOTICE} ${CONTACT_ADMIN}`);
        await expect(locked.locator('code')).toHaveText(advancedRule());

        // * No table editor to replace it, and auto-add can't be toggled
        await expect(tab.getByTestId('table-editor')).toHaveCount(0);
        await expect(tab.locator('#autoSyncMembersCheckbox')).toBeDisabled();

        await channelSettings.close();

        // * The saved rule is untouched
        expect(await getChannelRule(adminClient, channel.id)).toBe(advancedRule());
    });

    /**
     * @objective A system admin opening Channel Settings gets the lock without being told to contact a System Admin.
     */
    test('MM-71104_c2 system admin sees an Advanced rule locked with the system admin wording', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Save an Advanced rule as system admin
        const channel = await createPrivateChannel(adminClient, team.id);
        await saveChannelRule(adminClient, channel, advancedRule());

        // # Open Channel Settings → Membership Policy as the system admin
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        const {channelSettings, tab} = await openMembershipPolicyTab(channelsPage);

        // * The rule is locked with the system admin wording
        const locked = tab.getByTestId('channel-access-rules-locked-rules');
        await expect(locked).toBeVisible({timeout: 10000});
        await expect(locked.getByRole('status')).toHaveText(LOCKED_NOTICE);
        await expect(locked.getByRole('status')).not.toContainText('Contact a System Admin');
        await expect(locked.locator('code')).toHaveText(advancedRule());
        await expect(tab.getByTestId('table-editor')).toHaveCount(0);
        await expect(tab.locator('#autoSyncMembersCheckbox')).toBeDisabled();

        await channelSettings.close();
    });

    /**
     * @objective A rule the table editor can show stays editable for a channel admin.
     */
    test('MM-71104_c3 a simple rule is not locked for a channel admin', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, user, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Make the user a channel admin, then save a simple rule as system admin (the rule gates joins)
        const channel = await createPrivateChannel(adminClient, team.id);
        await makeChannelAdmin(adminClient, channel, user);
        await saveChannelRule(adminClient, channel, simpleRule());

        // # Open Channel Settings → Membership Policy as the channel admin
        const {page} = await pw.testBrowser.login(user);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        const {channelSettings, tab} = await openMembershipPolicyTab(channelsPage);

        // * The table editor is shown and the lock is not
        await expect(tab.getByTestId('table-editor')).toBeVisible({timeout: 10000});
        await expect(tab.getByTestId('channel-access-rules-locked-rules')).toHaveCount(0);
        await expect(tab.locator('#autoSyncMembersCheckbox')).toBeEnabled();

        await channelSettings.close();
    });

    /**
     * @objective The server refuses a channel admin replacing, writing or deleting a rule that needs the Advanced editor.
     */
    test('MM-71104_c4 channel admin API writes and deletes of an Advanced rule are refused', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Make the user a channel admin, then save an Advanced rule as system admin (the rule gates joins)
        const channel = await createPrivateChannel(adminClient, team.id);
        await makeChannelAdmin(adminClient, channel, user);
        await saveChannelRule(adminClient, channel, advancedRule());

        // * Replacing the Advanced rule with a simple one is refused
        await expectAdvancedRuleRejection(
            () => saveChannelRule(userClient, channel, simpleRule()),
            'channel admin replaced an Advanced rule',
        );

        // * Deleting the policy is refused
        await expectAdvancedRuleRejection(
            () => userClient.deleteAccessControlPolicy(channel.id),
            'channel admin deleted an Advanced rule',
        );

        // * The saved rule is untouched
        expect(await getChannelRule(adminClient, channel.id)).toBe(advancedRule());

        // # On a second channel with no rule yet
        const freshChannel = await createPrivateChannel(adminClient, team.id);
        await makeChannelAdmin(adminClient, freshChannel, user);

        // * Writing a new Advanced rule is refused
        await expectAdvancedRuleRejection(
            () => saveChannelRule(userClient, freshChannel, advancedRule()),
            'channel admin wrote an Advanced rule',
        );
    });
});
