// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import {expect, test} from '@mattermost/playwright-lib';

import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {waitForAttributeViewToInclude} from '../../../channels/team_settings/helpers';
import {createUserForABAC, ensureUserAttributes} from '../support';

import {assignTeamsToPolicy, createTeamMembershipParentPolicy, enableTeamMembershipPolicies} from './helpers';

/**
 * ABAC — Team directory "Recommended" tag
 *
 * A public (open-invite) governed team is advisory: it stays visible to everyone,
 * and a non-member who satisfies the policy is surfaced a transient, per-viewer
 * "recommended" hint. The flag is fail-secure (a non-qualifying viewer is never
 * tagged) and is never set on private governed teams (those are hidden, not
 * recommended). Asserted at the API layer so it proves the server-side annotation
 * across the full api4 → app filter/annotate → store-listing chain, plus a UI check
 * that the chip renders in the team-selection directory.
 *
 * @reference MM-69100
 */
test.describe('ABAC - Team directory recommended tag', {tag: ['@abac', '@team_membership']}, () => {
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
        for (const id of userIds) {
            await client.updateUserActive(id, false).catch(() => {});
        }
    });

    test('MM-69100-T1 - recommends a public governed team to a qualifying non-member only', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);
        await ensureUserAttributes(adminClient);

        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        const qualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        const nonQualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
        ]);
        createdUserIds.push(qualUser.id, nonQualUser.id);

        // A public (open-invite) governed team: advisory, so it stays visible to all;
        // qualifying non-members get the recommended hint. open-invite is set via patch
        // (the create payload does not persist it).
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
            `Recommended Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [publicGoverned.id]);

        await waitForAttributeViewToInclude(adminClient, expression, [qualUser.id], 45_000);

        await expect
            .poll(async () => (await adminClient.getTeam(publicGoverned.id)).policy_enforced, {
                timeout: 60_000,
                intervals: [1000, 2000, 5000, 5000, 5000],
            })
            .toBe(true);

        // API layer: the qualifying non-member's listing tags the team recommended;
        // the non-qualifying user's listing does not (fail-secure).
        const {client: qualClient} = await pw.makeClient({username: qualUser.username, password: qualUser.password});
        const {client: nonQualClient} = await pw.makeClient({
            username: nonQualUser.username,
            password: nonQualUser.password,
        });

        await expect
            .poll(
                async () => {
                    const teams = (await qualClient.getTeams(0, 200)) as Team[];
                    return teams.find((t) => t.id === publicGoverned.id)?.recommended === true;
                },
                {
                    timeout: 60_000,
                    intervals: [1000, 2000, 5000, 5000, 5000],
                    message: 'public governed team should be recommended to the qualifying user',
                },
            )
            .toBe(true);

        const nonQualTeams = (await nonQualClient.getTeams(0, 200)) as Team[];
        const nonQualRow = nonQualTeams.find((t) => t.id === publicGoverned.id);
        expect(nonQualRow).toBeDefined(); // advisory: still visible
        expect(Boolean(nonQualRow?.recommended)).toBe(false);
    });

    test('MM-69100-T2 - never recommends a private governed team, even to a qualifying user', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminClient} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);
        await ensureUserAttributes(adminClient);
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
        ]);

        const qualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        createdUserIds.push(qualUser.id);

        // A private (non-open-invite) governed team: strict. It is surfaced to the
        // qualifying user (directory widening) but must never carry the recommended tag.
        const privateGoverned = await adminClient.createTeam({
            name: `team-${pw.random.id()}`,
            display_name: `Private Governed ${pw.random.id()}`,
            type: 'O',
            allow_open_invite: false,
            email: `${pw.random.id()}@example.com`,
        } as any);
        createdTeamIds.push(privateGoverned.id);

        const expression = 'user.attributes.Department == "Engineering"';
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            `Private Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [privateGoverned.id]);

        await waitForAttributeViewToInclude(adminClient, expression, [qualUser.id], 45_000);

        await expect
            .poll(async () => (await adminClient.getTeam(privateGoverned.id)).policy_enforced, {
                timeout: 60_000,
                intervals: [1000, 2000, 5000, 5000, 5000],
            })
            .toBe(true);

        const {client: qualClient} = await pw.makeClient({username: qualUser.username, password: qualUser.password});

        // The qualifying user can see the private governed team (strict widening), but it
        // is never recommended — recommendation is a public-team-only, advisory concept.
        await expect
            .poll(
                async () => {
                    const teams = (await qualClient.getTeams(0, 200)) as Team[];
                    return teams.some((t) => t.id === privateGoverned.id);
                },
                {
                    timeout: 60_000,
                    intervals: [1000, 2000, 5000, 5000, 5000],
                    message: 'qualifying user should see the private governed team before asserting recommendation',
                },
            )
            .toBe(true);

        const teams = (await qualClient.getTeams(0, 200)) as Team[];
        const row = teams.find((t) => t.id === privateGoverned.id);
        expect(Boolean(row?.recommended)).toBe(false);
    });

    test('MM-69100-T3 - renders the Recommended chip in the team-selection directory for a qualifying user', async ({
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

        const qualUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
        ]);
        createdUserIds.push(qualUser.id);

        // Prefix with "AA" so the team sorts near the top of most environments.
        // The UI check in Part 2 below walks InfiniteScroll regardless, so an
        // exact page-0 guarantee is not required.
        const teamId = pw.random.id();
        const publicGoverned = await adminClient.createTeam({
            name: `team-${teamId}`,
            display_name: `AA Recommended${teamId}`,
            type: 'O',
            email: `${teamId}@example.com`,
        } as any);
        createdTeamIds.push(publicGoverned.id);
        await adminClient.patchTeam({id: publicGoverned.id, allow_open_invite: true} as any);

        const expression = 'user.attributes.Department == "Engineering"';
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            `Recommended UI Policy ${pw.random.id()}`,
            expression,
        );
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [publicGoverned.id]);

        // Wait for the materialized attribute view to include the qualifying user
        // before asserting policy propagation — the PDP reads from this view.
        await waitForAttributeViewToInclude(adminClient, expression, [qualUser.id], 45_000);

        // The child policy row is written to the master DB; the directory query
        // reads from a read replica. Poll policy_enforced until the replica has
        // caught up so the EXISTS subquery in GetAllPage widens correctly.
        await expect
            .poll(async () => (await adminClient.getTeam(publicGoverned.id)).policy_enforced, {
                timeout: 60_000,
                intervals: [1000, 2000, 5000, 5000, 5000],
                message: 'team should show policy_enforced=true before asserting recommended',
            })
            .toBe(true);

        const {page} = await pw.testBrowser.login(qualUser);
        await page.goto('/select_team');
        await page.waitForLoadState('networkidle');

        const chip = page
            .locator('.signup-team-dir')
            .filter({hasText: publicGoverned.display_name})
            .getByLabel('Recommended based on your attributes');

        await expect(chip).toBeVisible({timeout: 15000});
    });
});
