// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, systemConsolePath, test, verifyUserInChannel, type App, duration} from '@mattermost/playwright-lib';

import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    ensureUserAttributes,
    createUserForABAC,
    createPrivateChannelForABAC,
    getUserAttributeFieldByName,
} from '../support';
import {
    createMembershipPolicy,
    fieldNamed,
    openPolicy,
    policyIdByName,
    runSyncJob,
    setAbacEnabled,
    waitForSyncJob,
} from '../surface';

const CHANNELS_PATH = systemConsolePath('user_management/channels');

/** Opens System Console > Channels and finds a channel by name. */
async function openChannels(app: App, channel: {id: string; display_name: string}) {
    await app.page.goto(CHANNELS_PATH);
    const {channels} = app.admin;
    await channels.searchTextbox.fill(channel.display_name);
    await expect(channels.row(channel.id).nameText).toContainText(channel.display_name);
    return channels;
}

/**
 * ABAC Policies - Channel Integration
 * Tests for managing ABAC policies through Channel Configuration
 */
test.describe('ABAC Policies - Channel Integration', () => {
    /**
     * MM-T5788: Add attribute-based policy to a channel from Channel Configuration page
     * @objective Verify that a policy can be added to a channel from the Channel Configuration page
     *
     * Steps:
     * 1. As admin go to System Console > User Management > Channels
     */
    test('MM-T5788 Add policy to channel from Channel Configuration page', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP: Create users, channel, and policy
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        // Create satisfying user (Department=Engineering) - NOT in channel initially
        const satisfyingUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        await adminClient.addToTeam(team.id, satisfyingUser.id);

        // Create non-satisfying user (Department=Sales) - will be IN channel initially
        const nonSatisfyingUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);
        await adminClient.addToTeam(team.id, nonSatisfyingUser.id);

        // Create private channel and add non-satisfying user
        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(nonSatisfyingUser.id, channel.id);

        // # Log in, turn attribute-based access on, and create a policy without channels (linked from the channel)
        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);
        const policySuffix = pw.random.id();
        const policyName = `Channel Config Policy ${policySuffix}`;
        await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: fieldNamed(attributeFieldsMap, 'Department'), value: 'Engineering'}],
        });
        const policyId = await policyIdByName(adminClient, policyName);

        // ============================================================
        // STEP 1-2: Navigate to Channel Configuration
        // ============================================================
        const channels = await openChannels(app, channel);
        await channels.row(channel.id).editLink.click();

        // ============================================================
        // STEP 3: Toggle on "Enable attribute based channel access"
        // ============================================================
        const configuration = app.admin.channel;
        const enforce = configuration.policyEnforce.container;
        await expect(enforce).toBeVisible();
        await enforce.set(true);
        await expect(enforce).toBeChecked();

        // ============================================================
        // STEP 4: Link to policy and Save
        // ============================================================
        const policySelectionModal = await configuration.accessPolicy.linkButton.clickTo(app.policySelectionModal);
        // The modal loads its first page when it opens, and that response can land after a search's and replace
        // the results, so let it load before searching (by the name's unique suffix)
        await expect.poll(async () => (await policySelectionModal.policies.rowList.keys()).length).toBeGreaterThan(0);
        await policySelectionModal.policies.searchTextbox.fill(policySuffix);
        // The DataGrid name cell opens the editor but has no operable role or click driver.
        await policySelectionModal.policies.row(policyId).cell('name').click();
        await expect(policySelectionModal.policies.searchTextbox).not.toBeVisible();

        // * Saving returns to the channel list, where the channel is now managed by its attributes
        await configuration.savePanel.saveButton.click();
        await expect(app.page).toHavePath(CHANNELS_PATH);
        // the list is paged, and other tests' channels can push this one off the first page: search for it
        const list = await openChannels(app, channel);
        await expect(list.row(channel.id).cell('management')).toContainText('Attribute Based');

        // # Run sync to apply the policy
        await waitForSyncJob(adminClient, await runSyncJob(app));

        // ============================================================
        // VERIFY: Channel membership
        // ============================================================

        // * 1. Non-satisfying user is REMOVED
        expect(await verifyUserInChannel(adminClient, nonSatisfyingUser.id, channel.id)).toBe(false);

        // * 2. Satisfying user is NOT auto-added (per requirement)
        expect(await verifyUserInChannel(adminClient, satisfyingUser.id, channel.id)).toBe(false);

        // * 3. Satisfying user CAN be manually added
        await adminClient.addToChannel(satisfyingUser.id, channel.id);
        expect(await verifyUserInChannel(adminClient, satisfyingUser.id, channel.id)).toBe(true);

        // * 4. Non-satisfying user CANNOT be added (blocked by policy)
        await expect(adminClient.addToChannel(nonSatisfyingUser.id, channel.id)).rejects.toThrow();
    });

    /**
     * MM-T5789: Channel cannot use attribute-based policies if already constrained by LDAP group sync
     *
     * Preconditions:
     * - At least one policy exists on the server
     * - At least one channel configured to be constrained by LDAP group sync
     *
     * Step 1:
     * 1. As admin go to System Console > User Management > Channels
     * 2. Click a channel with Management = "Group Sync" (private channel)
     * 3. Observe "Enable attribute based channel access" is NOT available
     * 4. Toggle off "Sync Group Members", observe ABAC becomes available
     *
     * Step 2:
     * 1. Go to System Console > User Management > Attribute-Based Access
     * 2. Click a policy to edit it, click Add channels
     * 3. Select a channel constrained by LDAP group sync
     *
     * Expected: ABAC not available for channels using LDAP group sync
     *
     * Implementation Note: We mock Group Sync by setting group_constrained=true via API.
     * This works without LDAP - the server accepts it and UI shows "Group Sync".
     */
    test('MM-T5789 Channel with LDAP group sync cannot use ABAC', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const department = await getUserAttributeFieldByName(adminClient, 'Department');

        const {app} = await pw.testBrowser.login(adminUser);

        // ===========================================
        // PRECONDITION 1: Create a policy first
        // ===========================================
        await setAbacEnabled(app, true);
        const policyName = `ABAC-GroupSync-Test-${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: department, value: 'Engineering'}],
        });
        const policyId = await policyIdByName(adminClient, policyName);

        // ===========================================
        // PRECONDITION 2: Create a Group Sync channel via API
        // We mock Group Sync by setting group_constrained=true
        // This works without LDAP configuration
        // ===========================================
        const groupSyncChannelName = `ABAC-GroupSync-${pw.random.id()}`;
        const groupSyncChannel = await adminClient.createChannel({
            team_id: team.id,
            name: groupSyncChannelName.toLowerCase().replace(/[^a-z0-9]/g, ''),
            display_name: groupSyncChannelName,
            type: 'P', // Private
        });
        await adminClient.patchChannel(groupSyncChannel.id, {group_constrained: true} as any);

        // A private channel that is not group-synced, which the policy can take
        const plainChannel = await createPrivateChannelForABAC(adminClient, team.id);

        // ===========================================
        // STEP 1: Navigate to Group Sync channel config
        // ===========================================
        const channels = await openChannels(app, groupSyncChannel);

        // * The channel shows as "Group Sync"
        await expect(channels.row(groupSyncChannel.id).cell('management')).toContainText('Group Sync');

        // # Open its configuration
        await channels.row(groupSyncChannel.id).editLink.click();
        const configuration = app.admin.channel;

        // * STEP 1.3: the attribute-based access toggle is NOT available while Group Sync is on
        await expect(configuration.syncGroups.container).toBeVisible();
        await expect(configuration.policyEnforce.container).toHaveCount(0);

        // # STEP 1.4: Turn Group Sync off (through the API) and reload
        await adminClient.patchChannel(groupSyncChannel.id, {group_constrained: false} as any);
        await app.page.reload();

        // * The attribute-based access toggle is now available
        await expect(configuration.policyEnforce.container).toBeVisible();

        // # Re-enable Group Sync for Step 2
        await adminClient.patchChannel(groupSyncChannel.id, {group_constrained: true} as any);

        // ===========================================
        // STEP 2: Try to add the Group Sync channel to the policy
        // ===========================================
        const policy = await openPolicy(app, policyId);
        await policy.addChannelsButton.click();
        const {channels: picker} = app.channelSelectorModal;
        await expect(picker.searchCombobox).toBeVisible();

        // * A channel that isn't group-synced is offered
        await picker.searchCombobox.fill(plainChannel.name);
        await expect(picker.results.channel(plainChannel)).toBeVisible();

        // * The group-synced channel is not offered
        await picker.searchCombobox.fill(groupSyncChannelName);
        await expect(picker.results.noResultsText).toBeVisible();
        await expect(picker.results.channel(groupSyncChannel)).toHaveCount(0);
    });
});
