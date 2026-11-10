// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective A team sync removal cascades to private channel membership.
 *
 * When a user is removed from a private ABAC-governed team, the server calls
 * LeaveTeam which synchronously removes that user from every private channel
 * in the team. This spec exercises the full path end-to-end:
 *
 *   policy update → team sync → team removal → channel cascade (LeaveTeam)
 *
 * Two users start in both the team and a private channel. Updating the policy
 * to exclude one of them removes that user from the team AND the channel, while
 * the qualifying user is unaffected.
 *
 * Assertions run at two layers:
 *  1. API — direct membership queries confirm the server state.
 *  2. UI  — browser logins confirm what each user actually sees rendered.
 *
 * @reference MM-69100
 */

import {ChannelsPage, expect, newTestPassword, test, verifyUserInChannel} from '@mattermost/playwright-lib';

import {
    createPrivateChannel,
    createPrivateTeam,
    createPublicTeam,
    createTeamMembershipPolicy,
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

import {enableTeamMembershipPolicies, triggerSyncJobAndPoll} from './helpers';

test.describe('ABAC - Team Sync Channel Cascade', {tag: ['@abac', '@team_membership']}, () => {
    test.setTimeout(240000);

    let createdTeamIds: string[] = [];
    let createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds) {
            await adminClient.deleteTeam(id).catch(() => {});
        }
        createdTeamIds = [];
        for (const id of createdUserIds) {
            await adminClient.updateUserActive(id, false).catch(() => {});
        }
        createdUserIds = [];
    });

    /**
     * When the sync job removes a non-qualifying user from a private team, the
     * underlying LeaveTeam call also removes them from every private channel in
     * that team. Validated at both the API layer (membership queries) and the UI
     * layer (browser logins for each affected user).
     */
    test('MM-69100-T_cascade - team sync removal cascades to private channel membership', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        if (!adminClient) {
            throw new Error('Admin client not available');
        }
        const suffix = pw.random.id();

        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team (allow_open_invite=false → strict ABAC enforcement)
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        const {adminUser} = await pw.getAdminClient();
        if (adminUser) {
            await adminClient.removeFromTeam(team.id, adminUser.id).catch(() => {});
        }

        // # Private channel inside the governed team — the cascade target
        const privateChannel = await createPrivateChannel(adminClient, team.id);

        // # Public home team for mkt1. A user removed from their only team lands
        // # on a "Team not found" error and cannot navigate anywhere meaningful.
        // # homeTeam gives mkt1 a valid context for the UI assertions below.
        const homeTeam = await createPublicTeam(adminClient, `home${suffix}`);
        createdTeamIds.push(homeTeam.id);

        // # Create eng1 (Engineering) and mkt1 (Marketing) — track passwords for browser login
        const eng1Password = newTestPassword();
        const eng1 = await adminClient.createUser(
            {
                email: `eng1${suffix}@sample.mattermost.com`,
                username: `eng1${suffix}`,
                password: eng1Password,
            } as any,
            '',
            '',
        );
        await setUserAttribute(adminClient, eng1.id, 'Department', 'Engineering');

        const mkt1Password = newTestPassword();
        const mkt1 = await adminClient.createUser(
            {
                email: `mkt1${suffix}@sample.mattermost.com`,
                username: `mkt1${suffix}`,
                password: mkt1Password,
            } as any,
            '',
            '',
        );
        await setUserAttribute(adminClient, mkt1.id, 'Department', 'Marketing');
        await adminClient.addToTeam(homeTeam.id, mkt1.id);

        createdUserIds.push(eng1.id, mkt1.id);

        // Gate on the materialized attribute view — ABAC sync reads from a Postgres
        // view that refreshes at most once every 30 s. Freshly-written attributes
        // are not visible until the next refresh tick.
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Engineering" || user.attributes.Department == "Marketing"',
            [eng1.id, mkt1.id],
        );

        // =========================================================
        // Phase 1 — policy admits both; sync auto-adds both to team
        // =========================================================

        await createTeamMembershipPolicy(
            adminClient,
            team.id,
            'user.attributes.Department == "Engineering" || user.attributes.Department == "Marketing"',
            true, // active = auto-add
        );

        await triggerSyncJobAndPoll(adminClient, team.id);

        // * [API] Both are team members after first sync
        await expect
            .poll(
                async () => {
                    const members: any[] = await adminClient.getTeamMembers(team.id);
                    return members.map((m: any) => m.user_id);
                },
                {timeout: 15000, intervals: [500, 1000, 2000], message: 'both users should be auto-added to team'},
            )
            .toEqual(expect.arrayContaining([eng1.id, mkt1.id]));

        // Team sync adds users to the team (and town-square) only — not to
        // arbitrary private channels. Add both manually so the cascade has something to remove.
        await adminClient.addToChannel(eng1.id, privateChannel.id);
        await adminClient.addToChannel(mkt1.id, privateChannel.id);

        // * [API] Both in private channel — baseline confirmed
        expect(await verifyUserInChannel(adminClient, eng1.id, privateChannel.id)).toBe(true);
        expect(await verifyUserInChannel(adminClient, mkt1.id, privateChannel.id)).toBe(true);

        // =========================================================
        // Phase 2 — policy narrows to Engineering; mkt1 loses access
        // =========================================================

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        // Strict mode: sync removes mkt1 from team; LeaveTeam cascades to channels
        await triggerSyncJobAndPoll(adminClient, team.id);

        // * [API] mkt1 removed from team
        await expect
            .poll(
                async () => {
                    const members: any[] = await adminClient.getTeamMembers(team.id);
                    return members.map((m: any) => m.user_id);
                },
                {timeout: 15000, intervals: [500, 1000, 2000], message: 'mkt1 should be removed from team'},
            )
            .not.toContain(mkt1.id);

        // * [API] mkt1 cascade-removed from private channel
        await expect
            .poll(() => verifyUserInChannel(adminClient, mkt1.id, privateChannel.id), {
                timeout: 15000,
                intervals: [500, 1000, 2000],
                message: 'mkt1 should be cascade-removed from private channel',
            })
            .toBe(false);

        // * [API] eng1 still in team and channel
        await expect
            .poll(
                async () => {
                    const members: any[] = await adminClient.getTeamMembers(team.id);
                    return members.map((m: any) => m.user_id);
                },
                {timeout: 10000, intervals: [500, 1000], message: 'eng1 should remain in team'},
            )
            .toContain(eng1.id);
        expect(await verifyUserInChannel(adminClient, eng1.id, privateChannel.id)).toBe(true);

        // =========================================================
        // UI — mkt1: governed team gone from sidebar; channel inaccessible
        // =========================================================

        const mkt1WithPassword = {...mkt1, password: mkt1Password};
        const {page: mkt1Page} = await pw.testBrowser.login(mkt1WithPassword);
        const mkt1ChannelsPage = new ChannelsPage(mkt1Page);

        // Land on homeTeam so we have a valid context to inspect the sidebar from
        await mkt1ChannelsPage.goto(homeTeam.name, 'town-square');
        await mkt1ChannelsPage.toBeVisible();

        // * Navigating to the governed team URL redirects mkt1 away (no membership)
        await mkt1Page.goto(`/${team.name}/channels/town-square`);
        await mkt1Page.waitForLoadState('networkidle');
        await expect(mkt1Page).not.toHaveURL(new RegExp(`/${team.name}/`), {timeout: 10000});

        // =========================================================
        // UI — eng1: governed team and private channel still accessible
        // =========================================================

        const eng1WithPassword = {...eng1, password: eng1Password};
        const {page: eng1Page} = await pw.testBrowser.login(eng1WithPassword);
        const eng1ChannelsPage = new ChannelsPage(eng1Page);

        // * eng1 can access the governed team — URL confirms they are on it
        // (team sidebar icon only renders when the user belongs to multiple teams,
        // so we assert the route instead of the sidebar element)
        await eng1ChannelsPage.goto(team.name, 'town-square');
        await eng1ChannelsPage.toBeVisible();
        await expect(eng1Page).toHaveURL(new RegExp(`/${team.name}/`), {timeout: 10000});

        // * Private channel is accessible to eng1
        await eng1ChannelsPage.goto(team.name, privateChannel.name);
        await eng1ChannelsPage.toBeVisible();
        await expect(eng1Page.locator('#channelHeaderTitle', {hasText: privateChannel.display_name})).toBeVisible({
            timeout: 10000,
        });
    });
});
