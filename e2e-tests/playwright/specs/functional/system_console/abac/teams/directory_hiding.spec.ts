// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import {expect, test} from '@mattermost/playwright-lib';

import {
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
} from '../../../channels/custom_profile_attributes/helpers';
import {waitForAttributeViewToInclude} from '../../../channels/team_settings/helpers';
import {createUserForABAC, ensureUserAttributes} from '../support';

import {assignTeamsToPolicy, createTeamMembershipParentPolicy, enableTeamMembershipPolicies} from './helpers';

/**
 * ABAC — Team directory hiding
 *
 * Enforcement is mode-dependent. A private (non-open-invite) governed team is
 * strict: it is surfaced into the directory only for non-members who satisfy the
 * policy and omitted for everyone else. A public (open-invite) governed team is
 * advisory: it stays visible to all. Asserted at the API layer (each user's own
 * client) so it proves server-side filtering, not just DOM hiding — exercising the
 * full api4 → app filter → store-listing chain, including the governed-team
 * listing widening that surfaces private governed teams to qualifying users.
 */
test.describe('ABAC - Team directory hiding', {tag: ['@abac', '@team_membership']}, () => {
    // Each test cleans up the resources it creates, even on failure. initSetup's
    // own team/users are owned by the framework and left alone.
    let cleanupClient: Client4 | undefined;
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];
    const createdPolicyIds: string[] = [];

    test.afterEach(async () => {
        const client = cleanupClient;
        cleanupClient = undefined;
        const policyIds = createdPolicyIds.splice(0);
        const teamIds = createdTeamIds.splice(0);
        const userIds = createdUserIds.splice(0);
        if (!client) {
            return;
        }
        const base = client.getBaseRoute();
        const headers = {Authorization: `Bearer ${client.getToken()}`};
        for (const id of policyIds) {
            await fetch(`${base}/access_control_policies/${id}`, {method: 'DELETE', headers}).catch(() => {});
        }
        for (const id of teamIds) {
            await client.deleteTeam(id).catch(() => {});
        }
        // Hard user deletion requires server config; deactivating is the API-safe cleanup.
        for (const id of userIds) {
            await client.updateUserActive(id, false).catch(() => {});
        }
    });

    test('MM-68846-T1 - omits a policy-governed team from the directory for non-qualifying users', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);
        await ensureUserAttributes(adminClient);

        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        // Two non-members: one qualifies (Engineering), one does not (Sales).
        const qualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        const nonQualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);
        createdUserIds.push(qualUser.id, nonQualUser.id);

        // A private (non-open-invite) governed team is strict: ABAC surfaces it into
        // the directory only for users who qualify and hides it from everyone else.
        // The policy never mutates allow_open_invite.
        await adminClient.patchTeam({id: team.id, allow_open_invite: false} as any);

        const expression = 'user.attributes.Department == "Engineering"';
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            `Directory Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        // Control: a private team with NO policy. The listing widening must surface
        // only governed teams, so this one stays invisible to both users regardless
        // of qualification — guarding against the OR clause over-widening.
        const ungoverned = await adminClient.createTeam({
            name: `team-${pw.random.id()}`,
            display_name: `Ungoverned ${pw.random.id()}`,
            type: 'O',
            allow_open_invite: false,
            email: `${pw.random.id()}@example.com`,
        } as any);
        createdTeamIds.push(ungoverned.id);

        // ABAC evaluates against a materialized view that refreshes on an interval;
        // wait until the qualifying user is visible to the evaluator before asserting.
        await waitForAttributeViewToInclude(adminClient, expression, [qualUser.id], 45_000);

        // API layer: proves the server filters the listing, not just the DOM.
        const {client: qualClient} = await pw.makeClient({username: qualUser.username, password: qualUser.password});
        const {client: nonQualClient} = await pw.makeClient({
            username: nonQualUser.username,
            password: nonQualUser.password,
        });

        const qualTeams = (await qualClient.getTeams(0, 200)) as Team[];
        const nonQualTeams = (await nonQualClient.getTeams(0, 200)) as Team[];

        expect(qualTeams.map((t) => t.id)).toContain(team.id);
        expect(nonQualTeams.map((t) => t.id)).not.toContain(team.id);

        // The ungoverned private team is never surfaced, qualified or not.
        expect(qualTeams.map((t) => t.id)).not.toContain(ungoverned.id);
        expect(nonQualTeams.map((t) => t.id)).not.toContain(ungoverned.id);

        // The boundary is asserted at the API layer. The /select_team directory page
        // additionally filters joinable teams to open-invite teams client-side, so it
        // never renders a private governed team regardless of the server decision —
        // surfacing those in the directory UI is separate webapp work.
    });

    test('MM-68846-T2 - hides a governed team from a non-qualifying system admin in the directory while the management listing stays complete', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);
        await ensureUserAttributes(adminClient);
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        // Give the admin a present-but-non-matching Department so the policy
        // deterministically denies them. A missing attribute is not the same as a
        // wrong one — the expression must evaluate to false, not error on an absent
        // key — so the admin gets "Sales" against an "Engineering" policy.
        await setupCustomProfileAttributeValuesForUser(
            adminClient,
            [{name: 'Department', value: 'Sales', type: 'text'}],
            attributeFieldsMap,
            adminUser.id,
        );

        // A private (non-open-invite), policy-governed team the admin is NOT a member
        // of: create it as admin (the creator is auto-joined), then remove the admin
        // so the directory treats them as a non-member non-qualifying browser. Private
        // → strict, so for_directory hiding applies to the admin too.
        const governed = await adminClient.createTeam({
            name: `team-${pw.random.id()}`,
            display_name: `Governed ${pw.random.id()}`,
            type: 'O',
            allow_open_invite: false,
            email: `${pw.random.id()}@example.com`,
        } as any);
        createdTeamIds.push(governed.id);
        await adminClient.removeFromTeam(governed.id, adminUser.id);

        const expression = 'user.attributes.Department == "Engineering"';
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            `Admin Directory Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [governed.id]);

        const base = adminClient.getBaseRoute();
        const headers = {Authorization: `Bearer ${adminClient.getToken()}`};
        const listDirectoryTeamIds = async (forDirectory: boolean): Promise<string[]> => {
            const url = `${base}/teams?page=0&per_page=200${forDirectory ? '&for_directory=true' : ''}`;
            const resp = await fetch(url, {headers});
            const teams = (await resp.json()) as Team[];
            return teams.map((t) => t.id);
        };

        // The assignment becomes visible through a materialized attribute view and a
        // read replica, so poll the directory listing until the governed team drops
        // out for the admin (for_directory) rather than asserting on the first read.
        // A transient fetch error counts as "not ready yet" so the poll keeps going.
        await expect
            .poll(
                async () => {
                    try {
                        return (await listDirectoryTeamIds(true)).includes(governed.id);
                    } catch {
                        return true;
                    }
                },
                {
                    timeout: 60_000,
                    intervals: [1000, 2000, 5000, 5000, 5000],
                    message: 'governed team should be hidden from the admin directory listing',
                },
            )
            .toBe(false);

        // Without for_directory the admin stays exempt, so the System Console listing
        // is still complete.
        expect(await listDirectoryTeamIds(false)).toContain(governed.id);

        // UI: with the backend confirmed above, the team-selection directory hides it
        // for the admin too.
        const adminSession = await pw.testBrowser.login(adminUser);
        await adminSession.page.goto('/select_team');
        await adminSession.page.waitForLoadState('networkidle');
        await expect(adminSession.page.getByText(governed.display_name, {exact: false})).toHaveCount(0);
    });

    test('MM-68846-T3 - keeps a public governed team visible to a non-qualifying user (advisory mode)', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);
        await ensureUserAttributes(adminClient);
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        // A user who does NOT satisfy the policy (Sales against an Engineering rule).
        const nonQualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);
        createdUserIds.push(nonQualUser.id);

        // A public (open-invite) governed team: the policy is advisory, so it stays
        // in the directory for everyone regardless of qualification — no hiding.
        // open-invite is set via patch (the create payload does not persist it).
        const publicGoverned = await adminClient.createTeam({
            name: `team-${pw.random.id()}`,
            display_name: `Public Governed ${pw.random.id()}`,
            type: 'O',
            email: `${pw.random.id()}@example.com`,
        } as any);
        createdTeamIds.push(publicGoverned.id);
        await adminClient.patchTeam({id: publicGoverned.id, allow_open_invite: true} as any);

        const expression = 'user.attributes.Department == "Engineering"';
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            `Advisory Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [publicGoverned.id]);

        // Confirm enforcement is actually live before asserting advisory behavior —
        // otherwise "visible" is indistinguishable from a plain ungoverned public team
        // and a regression to strict-on-public would go undetected.
        await expect
            .poll(async () => (await adminClient.getTeam(publicGoverned.id)).policy_enforced, {
                timeout: 60_000,
                intervals: [1000, 2000, 5000, 5000, 5000],
            })
            .toBe(true);

        // Advisory: despite being governed, the public team stays visible to the
        // non-qualifying user — the policy never hides it.
        const {client: nonQualClient} = await pw.makeClient({
            username: nonQualUser.username,
            password: nonQualUser.password,
        });
        const nonQualTeams = (await nonQualClient.getTeams(0, 200)) as Team[];
        expect(nonQualTeams.map((t) => t.id)).toContain(publicGoverned.id);
    });

    test('MM-68846-T4 - join gate forks on privacy mode: advisory public admits, strict private denies', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);
        await ensureUserAttributes(adminClient);
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        // Present-but-wrong attribute (Sales against an Engineering rule) so the PDP
        // evaluates the user to false rather than erroring on a missing key.
        const nonQualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);
        createdUserIds.push(nonQualUser.id);

        // The admin drives the readiness poll below; give them the same present-but-
        // wrong attribute so the private team deterministically drops from their
        // for_directory listing once enforcement is live.
        await setupCustomProfileAttributeValuesForUser(
            adminClient,
            [{name: 'Department', value: 'Sales', type: 'text'}],
            attributeFieldsMap,
            adminUser.id,
        );

        const expression = 'user.attributes.Department == "Engineering"';
        const newGovernedTeam = async (open: boolean) => {
            const t = await adminClient.createTeam({
                name: `team-${pw.random.id()}`,
                display_name: `Governed ${pw.random.id()}`,
                type: 'O',
                email: `${pw.random.id()}@example.com`,
            } as any);
            createdTeamIds.push(t.id);
            if (open) {
                // open-invite is set via patch (the create payload does not persist it).
                await adminClient.patchTeam({id: t.id, allow_open_invite: true} as any);
            }
            // The creator is auto-joined, and members always retain directory
            // visibility — remove the admin so they read as a non-member browser.
            await adminClient.removeFromTeam(t.id, adminUser.id);
            const policy = await createTeamMembershipParentPolicy(
                adminClient,
                `Join Gate ${open ? 'Public' : 'Private'} ${pw.random.id()}`,
                expression,
            );
            createdPolicyIds.push(policy.id);
            await assignTeamsToPolicy(adminClient, policy.id, [t.id]);
            return t;
        };

        const publicGoverned = await newGovernedTeam(true);
        const privateGoverned = await newGovernedTeam(false);

        // The private team's enforcement reaches the join gate through a materialized
        // view and a read replica. Poll the admin's for_directory listing until the
        // team drops out: the admin always has it in-candidate (list_private_teams),
        // so it dropping out positively confirms the policy is live AND the PDP
        // denies — exactly the state the join gate evaluates. Polling the
        // non-qualifying user's listing would be ambiguous (absent both before the
        // policy propagates and after it is hidden).
        const base = adminClient.getBaseRoute();
        const headers = {Authorization: `Bearer ${adminClient.getToken()}`};
        await expect
            .poll(
                async () => {
                    try {
                        const resp = await fetch(`${base}/teams?page=0&per_page=200&for_directory=true`, {headers});
                        return ((await resp.json()) as Team[]).map((t) => t.id).includes(privateGoverned.id);
                    } catch {
                        return true;
                    }
                },
                {timeout: 60_000, intervals: [1000, 2000, 5000, 5000, 5000]},
            )
            .toBe(false);

        // Confirm the public team is genuinely governed before asserting advisory
        // admission — otherwise a "successful join" would just be a plain public team
        // and a regression to strict-on-public would slip through.
        await expect
            .poll(async () => (await adminClient.getTeam(publicGoverned.id)).policy_enforced, {
                timeout: 60_000,
                intervals: [1000, 2000, 5000, 5000, 5000],
            })
            .toBe(true);

        // Advisory: the gate is skipped on a governed public team, so the
        // non-qualifying user is admitted.
        const member = await adminClient.addToTeam(publicGoverned.id, nonQualUser.id);
        expect(member.user_id).toBe(nonQualUser.id);

        // Strict: the same user is denied on the private team — directory visibility
        // never translates into join access, and no role bypasses the gate.
        let denied = false;
        try {
            await adminClient.addToTeam(privateGoverned.id, nonQualUser.id);
        } catch {
            denied = true;
        }
        expect(denied).toBe(true);
    });
});
