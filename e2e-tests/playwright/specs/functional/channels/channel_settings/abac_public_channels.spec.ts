// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E coverage for public-channel ABAC behavior:
 *   - Default channels are not eligible for ABAC policies (channel-settings + team-settings paths)
 *   - A policy on a public channel surfaces matching users a "Recommended" channel entry
 *
 * @reference Public-channel ABAC feature
 */

import {ChannelsPage, expect, getAdminClient, test} from '@mattermost/playwright-lib';

import {enableABACConfig, enableAPIUserDeletion} from '../team_settings/helpers';

import {
    CleanupLedger,
    createPolicyAssignedToChannels,
    createTrackedAttribute,
    createTrackedPublicChannel,
    createTrackedTeamMember,
    runAccessControlSyncJob,
    setChannelPolicyActive,
    waitForJobCompletion,
} from './helpers';

test.describe('ABAC - Public channels', () => {
    let ledger: CleanupLedger;

    // Enable the permanent-delete API once for the whole describe so the
    // CleanupLedger's permanentDeleteUser cleanup tasks succeed instead of
    // spamming "Permanent user deletion feature is not enabled" on teardown.
    // `pw` is test-scoped, so we use the worker-scoped getAdminClient here.
    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            return;
        }
        await enableAPIUserDeletion(adminClient);
    });

    test.beforeEach(() => {
        ledger = new CleanupLedger();
    });

    test.afterEach(async () => {
        await ledger.drain();
    });

    test('Default channel hides Membership Policy tab in Channel Settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Open Channel Settings on the default (town-square) channel
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const channelSettings = await channelsPage.openChannelSettings();

        // * Membership Policy tab is NOT rendered for the default channel —
        // ValidateChannelEligibilityForAccessControl rejects default channels
        // server-side, so the tab would only let a user assemble unsaveable rules.
        await expect(channelSettings.container.getByTestId('access_rules-tab-button')).not.toBeVisible();

        await channelSettings.close();
    });

    test('Default channel is excluded from Team Settings policy editor channel selector', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Navigate to Team Settings → Membership Policies → New policy editor
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        // # Open the channel selector modal
        await teamSettings.container.getByRole('button', {name: /Add channels/i}).click();
        const channelSelector = page.locator('.channel-selector-modal');
        await channelSelector.waitFor();

        // * Both default channels (town-square, off-topic) are absent from the list.
        // The component contract is `excludeDefaultChannels={true}` — assert the
        // canonical channel rows by their stable test ids rather than display text.
        await expect(channelSelector.locator('[data-testid="ChannelRow-town-square"]')).toHaveCount(0);
        await expect(channelSelector.locator('[data-testid="ChannelRow-off-topic"]')).toHaveCount(0);

        await teamSettings.close();
    });

    test('Public channel with matching policy surfaces as Recommended for matching user (auto-add off)', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        // # Per-test custom profile attribute. We don't reuse a shared "Department"
        //   field — the server caps CPA fields at 20, and accumulating shared
        //   state across tests has historically saturated that limit and broken
        //   subsequent runs. This field gets cleaned up via the ledger.
        const attribute = await createTrackedAttribute(adminClient, 'PubAbacDept', ledger);

        // # Public channel + parent policy with rule "<attr> == 'engineering'",
        //   policy assigned to that channel. Auto-add stays OFF (server default
        //   on a freshly-created child policy).
        const publicChannel = await createTrackedPublicChannel(adminClient, team.id, ledger);
        // CEL references the attribute by its field name (lowercased to keep
        // the identifier characters CEL-safe — uppercase chars in identifiers
        // are technically valid but the table-editor parser used in the webapp
        // round-trips through lowercase, so this matches reality).
        const expression = `user.attributes.${attribute.name} == 'engineering'`;
        await createPolicyAssignedToChannels(
            adminClient,
            `Public Recommend ${Date.now()}`,
            expression,
            [publicChannel.id],
            ledger,
        );

        // # Matching user — value matches the rule, member of the team but NOT
        //   of the channel. Auto-add is off, so they must NOT be auto-joined;
        //   the channel should instead appear in their Recommended list.
        const matchingUser = await createTrackedTeamMember(
            adminClient,
            team.id,
            {fieldId: attribute.id, value: 'engineering'},
            ledger,
        );

        // * Auto-add OFF contract: the matching user must NOT have been silently
        //   joined to the channel. Verified server-side before any UI flow so a
        //   regression that auto-adds them would fail here, regardless of UI
        //   behavior. The Browse-Channels assertion below proves the channel
        //   *appears as a recommendation* — but only this membership check
        //   distinguishes "recommended (advisory)" from "auto-added".
        const preMembers = await adminClient.getChannelMembers(publicChannel.id);
        expect(
            preMembers.map((m: any) => m.user_id),
            'matching user must not be auto-joined when auto-add is OFF (advisory recommendation only)',
        ).not.toContain(matchingUser.id);

        const {page} = await pw.testBrowser.login(matchingUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Open Browse Channels and switch the type filter to "Recommended channels"
        const browse = await channelsPage.openBrowseChannelsModal();
        await browse.toBeDoneLoading();

        // The recommended menu item is keyed by `id="channelsMoreDropdownRecommended"`,
        // gated by the `showRecommendedFilter` prop which is set whenever ABAC is
        // enabled in client config. Using the stable id avoids brittleness from
        // the dropdown's localized label.
        await browse.container.locator('#menuWrapper').click();
        await page.locator('#channelsMoreDropdownRecommended').click();

        // * The public channel appears in the Recommended results. The row id
        //   is generated by the SearchableChannelList component as
        //   `ChannelRow-${channel.name}` — assert against that, not the display
        //   text, which can be locale-dependent.
        const channelRow = browse.container.locator(`[data-testid="ChannelRow-${publicChannel.name}"]`);
        await expect(channelRow).toBeVisible({timeout: 15000});
    });

    test('Public channel with auto-add ON adds matching users; non-matching members are NOT removed', async ({pw}) => {
        // The sync job is queued and processed asynchronously — give the test
        // enough headroom for the queue + evaluation + member writes. Empirically
        // it finishes in <10s on a quiet dev server, but CI workers are slower.
        test.setTimeout(120_000);

        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);

        const attribute = await createTrackedAttribute(adminClient, 'PubAbacAuto', ledger);
        const publicChannel = await createTrackedPublicChannel(adminClient, team.id, ledger);
        const expression = `user.attributes.${attribute.name} == 'engineering'`;
        await createPolicyAssignedToChannels(
            adminClient,
            `Public Auto-Add ${Date.now()}`,
            expression,
            [publicChannel.id],
            ledger,
        );

        // # Auto-add ON: flip the channel-scope (child) policy's Active flag.
        //   The parent default is inactive, and children inherit Active=false at
        //   assign time, so we activate the child directly here. The sync job
        //   only auto-adds members for Active policies.
        await setChannelPolicyActive(adminClient, publicChannel.id, true);

        // # Two users:
        //   - matching:    Department=engineering, in team but NOT in channel.
        //                  Sync should auto-add them.
        //   - nonMatching: Department=sales, already a member of the channel.
        //                  For PUBLIC channels, ABAC is advisory: sync must NOT
        //                  remove them. (For private channels, sync would.)
        const matching = await createTrackedTeamMember(
            adminClient,
            team.id,
            {fieldId: attribute.id, value: 'engineering'},
            ledger,
        );
        const nonMatching = await createTrackedTeamMember(
            adminClient,
            team.id,
            {fieldId: attribute.id, value: 'sales'},
            ledger,
        );
        await adminClient.addToChannel(nonMatching.id, publicChannel.id);

        // # Trigger sync against this channel-scope policy and wait for it to
        //   reach a terminal state. We pass `publicChannel.id` (the child
        //   policy ID) rather than the parent ID so the sync stays scoped to
        //   this test and ignores any other policies on the dev server.
        const job = await runAccessControlSyncJob(adminClient, publicChannel.id);
        const finished = await waitForJobCompletion(adminClient, job.id);
        expect(finished.status, `sync job did not succeed: ${JSON.stringify(finished)}`).toBe('success');

        // * Membership state via API — no UI flake.
        const members = await adminClient.getChannelMembers(publicChannel.id);
        const memberIds = members.map((m: any) => m.user_id);

        expect(memberIds, 'matching user must be auto-added by sync').toContain(matching.id);
        expect(
            memberIds,
            'non-matching member must NOT be removed (public channels are advisory under ABAC)',
        ).toContain(nonMatching.id);
    });
});
