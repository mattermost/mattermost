// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The DM/GM actions in the policy editors: offered under their own heading in the System
 * Console permission policy editor, confirmed before saving for Read only, labelled in the
 * policy list, and absent from Channel Settings, since a channel policy can't carry them.
 *
 * Every policy saved here allows everyone (ALLOW_ALL_CEL), so nothing these tests save
 * takes a conversation away from anyone.
 */

import {ChannelsPage, expect, getRandomId, test} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createPrivateChannel,
} from '../../../channels/team_settings/helpers';
import {
    createPermissionPolicy,
    ensureUserAttributes,
    getPolicyIdByName,
    navigateToPermissionPoliciesPage,
} from '../support';

import {
    DM_GM_READ_ACCESS,
    DM_GM_START,
    DM_GM_WRITE_ACCESS,
    deletePolicyById,
    ensureABACEnabled,
    prepareDmGmTest,
} from './helpers';

// Every test in this file asks for the same flags, so the file restarts the server at most once.
const FLAGS = {PermissionPolicies: true, ChannelPermissionPolicies: true};

const ALLOW_ALL_CEL = "user.email != 'no-such-user@nowhere.invalid'";

let policyIds: string[] = [];
let savedAdminClient: any;

test.afterEach(async () => {
    if (savedAdminClient) {
        for (const id of policyIds) {
            await deletePolicyById(savedAdminClient, id);
        }
    }
    policyIds = [];
});

async function rememberPolicy(adminClient: any, name: string) {
    let id: string | null = null;
    await expect
        .poll(
            async () => {
                id = await getPolicyIdByName(adminClient, name, 1);
                return Boolean(id);
            },
            {timeout: 30000, intervals: [500, 1000, 2000]},
        )
        .toBe(true);
    policyIds.push(id as unknown as string);
}

/**
 * @objective Verify the permission policy editor offers the three DM/GM actions under a
 * "Direct and Group Messages" heading.
 *
 * @precondition
 * PermissionPolicies and ChannelPermissionPolicies feature flags on, an Enterprise Advanced
 * licence, and attribute-based access control enabled.
 */
test('offers the DM/GM actions under their own heading in the policy editor', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw, FLAGS);

    const {adminUser, adminClient} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureABACEnabled(adminClient);
    await ensureUserAttributes(adminClient);

    // # Open a new permission policy
    const {page} = await pw.testBrowser.login(adminUser);
    await navigateToPermissionPoliciesPage(page);
    await page.getByRole('button', {name: 'Add policy'}).click();
    await page.waitForLoadState('networkidle');

    // # Open the add-permission menu
    await page.getByRole('button', {name: 'Add permission'}).click();
    const menu = page.locator('#pp-add-permission-menu');

    // * Verify the heading and the three actions are offered alongside the channel ones
    await expect(menu.getByText('Direct and Group Messages', {exact: true})).toBeVisible();
    await expect(menu.locator(`#pp-add-permission-${DM_GM_START}`)).toContainText('Start Direct and Group Messages');
    await expect(menu.locator(`#pp-add-permission-${DM_GM_READ_ACCESS}`)).toContainText(
        'Read Direct and Group Messages',
    );
    await expect(menu.locator(`#pp-add-permission-${DM_GM_WRITE_ACCESS}`)).toContainText(
        'Write Direct and Group Messages',
    );
    await expect(menu.locator('#pp-add-permission-channel_read_access')).toBeVisible();
});

/**
 * @objective Verify a policy carrying Read Direct and Group Messages asks for confirmation
 * before saving, explaining its effect on conversations.
 *
 * @precondition
 * PermissionPolicies and ChannelPermissionPolicies feature flags on, an Enterprise Advanced
 * licence, and attribute-based access control enabled.
 */
test('confirms a Read Direct and Group Messages policy before saving', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw, FLAGS);
    test.setTimeout(pw.duration.two_min);

    const {adminUser, adminClient} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureABACEnabled(adminClient);

    const {page} = await pw.testBrowser.login(adminUser);
    const name = `DM/GM Read ${getRandomId()}`;

    // # Save a Read policy. createPermissionPolicy waits for the confirmation and accepts it,
    // so the dialog's text is read as soon as it appears.
    const [confirmText] = await Promise.all([
        page.locator('#channel-access-confirm-modal').textContent(),
        createPermissionPolicy(page, {
            name,
            celExpression: ALLOW_ALL_CEL,
            permissions: ['Read Direct and Group Messages'],
            adminClient,
        }),
    ]);
    await rememberPolicy(adminClient, name);

    // * Verify the confirmation described the DM/GM scope and effect, not the channel one
    expect(confirmText).toContain('This policy controls Read Direct and Group Messages across the workspace.');
    expect(confirmText).toContain('stop seeing direct and group messages, including messages from bots');
    expect(confirmText).not.toContain('Channel Read Access');
});

/**
 * @objective Verify Start and Write Direct and Group Messages save without a confirmation and
 * are labelled in the policy list.
 *
 * @precondition
 * PermissionPolicies and ChannelPermissionPolicies feature flags on, an Enterprise Advanced
 * licence, and attribute-based access control enabled.
 */
test('saves Start and Write without confirmation and labels them in the list', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw, FLAGS);
    test.setTimeout(pw.duration.two_min);

    const {adminUser, adminClient} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureABACEnabled(adminClient);

    const {page} = await pw.testBrowser.login(adminUser);
    const name = `DM/GM Start Write ${getRandomId()}`;

    // # Save a Start and Write policy
    await createPermissionPolicy(page, {
        name,
        celExpression: ALLOW_ALL_CEL,
        permissions: ['Start Direct and Group Messages', 'Write Direct and Group Messages'],
        adminClient,
    });

    // * Verify it saved, which a confirmation dialog would have blocked
    await rememberPolicy(adminClient, name);
    await expect(page.locator('#channel-access-confirm-modal')).not.toBeVisible();

    // # Open the policy list
    await navigateToPermissionPoliciesPage(page);

    // * Verify the row names both actions
    const row = page.locator('.DataGrid_row').filter({hasText: name}).first();
    await expect(row).toContainText('Start Direct and Group Messages');
    await expect(row).toContainText('Write Direct and Group Messages');
});

/**
 * @objective Verify Channel Settings > Permissions Policy doesn't offer the DM/GM actions,
 * which only a system policy can carry.
 *
 * @precondition
 * PermissionPolicies and ChannelPermissionPolicies feature flags on, an Enterprise Advanced
 * licence, and attribute-based access control enabled.
 */
test('does not offer the DM/GM actions in Channel Settings', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw, FLAGS);

    const {adminUser, adminClient, team} = await pw.initSetup();
    savedAdminClient = adminClient;
    await enableABACConfig(adminClient);
    await ensureDepartmentAttribute(adminClient);
    const channel = await createPrivateChannel(adminClient, team.id);

    // # Open the channel's Permissions Policy tab and start a rule
    const {page} = await pw.testBrowser.login(adminUser);
    const channelsPage = new ChannelsPage(page);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const channelSettings = await channelsPage.openChannelSettings();
    await channelSettings.container.getByTestId('permissions_policy-tab-button').click();
    await channelSettings.container.getByTestId('permissions-policy-add-rule').click();
    await expect(channelSettings.container.getByTestId('permissions-policy-editor')).toBeVisible();

    // # Open its add-permission menu
    await channelSettings.container.getByTestId('permissions-policy-editor-add-permission').click();

    // * Verify the file actions are offered and the DM/GM ones are not
    await expect(page.getByTestId('cpp-add-permission-upload_file_attachment')).toBeVisible();
    for (const action of [DM_GM_START, DM_GM_READ_ACCESS, DM_GM_WRITE_ACCESS]) {
        await expect(page.getByTestId(`cpp-add-permission-${action}`)).toHaveCount(0);
    }
    await expect(page.getByText('Direct and Group Messages', {exact: true})).toHaveCount(0);
});
