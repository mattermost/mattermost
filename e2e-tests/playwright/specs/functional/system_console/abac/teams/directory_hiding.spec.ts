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
 * ABAC — Team directory hiding (P1-17)
 *
 * A policy-governed open team must be omitted from the team directory for
 * non-members who don't satisfy the policy, while qualifying users still see it.
 * Asserted at the API layer (each user's own client) so it proves server-side
 * filtering, not just DOM hiding — and exercises the full api4 → app filter →
 * store-listing chain (the seam that regressed when GetAllPage stopped
 * hydrating PolicyEnforced).
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

        // The team must be open-invite to appear in the directory at all; ABAC then
        // narrows who can actually see it. AllowOpenInvite is never mutated by the policy.
        await adminClient.patchTeam({id: team.id, allow_open_invite: true} as any);

        const expression = 'user.attributes.Department == "Engineering"';
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            `Directory Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

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

        // UI layer: on the team-selection page the qualifying user sees the team and
        // the non-qualifying user does not.
        const qualSession = await pw.testBrowser.login(qualUser);
        await qualSession.page.goto('/select_team');
        await qualSession.page.waitForLoadState('networkidle');
        await expect(qualSession.page.getByText(team.display_name, {exact: false}).first()).toBeVisible({
            timeout: 10000,
        });

        const nonQualSession = await pw.testBrowser.login(nonQualUser);
        await nonQualSession.page.goto('/select_team');
        await nonQualSession.page.waitForLoadState('networkidle');
        await expect(nonQualSession.page.getByText(team.display_name, {exact: false})).toHaveCount(0);
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

        // An open-invite, policy-governed team the admin is NOT a member of: create
        // it as admin (the creator is auto-joined), then remove the admin so the
        // directory treats them as a non-member non-qualifying browser.
        const governed = await adminClient.createTeam({
            name: `team-${pw.random.id()}`,
            display_name: `Governed ${pw.random.id()}`,
            type: 'O',
            email: `${pw.random.id()}@example.com`,
        } as any);
        createdTeamIds.push(governed.id);
        await adminClient.patchTeam({id: governed.id, allow_open_invite: true} as any);
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
});
