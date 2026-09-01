// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective API-level enforcement gate: non-qualifying users are rejected when joining a private
 *            ABAC-governed team; the same call is allowed on a public (advisory) team.
 * @reference MM-69100
 */

import {expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    createPrivateTeam,
    createPublicTeam,
    createTeamMembershipPolicy,
    ensureDepartmentAttribute,
    enableTeamMembershipABACConfig,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

// Raw fetch wrapper — returns status + body so tests can assert on both success and rejection
// without doFetch swallowing the error.
async function addTeamMemberRaw(
    token: string | null,
    baseRoute: string,
    teamId: string,
    userId: string,
): Promise<{status: number; body: any}> {
    const res = await fetch(`${baseRoute}/teams/${teamId}/members`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({team_id: teamId, user_id: userId}),
    });
    let body: any = {};
    try {
        body = await res.json();
    } catch {
        // empty body is fine
    }
    return {status: res.status, body};
}

// Log in via raw REST to obtain the user's OWN session token, so a self-join can be
// attempted with the requesting user's session rather than the admin's (which would
// bypass the attribute gate). The token is returned in the response 'Token' header.
async function loginRaw(baseRoute: string, loginId: string, password: string): Promise<string> {
    const res = await fetch(`${baseRoute}/users/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({login_id: loginId, password}),
    });
    return res.headers.get('Token') ?? '';
}

test.describe('ABAC - Join enforcement gate (API level)', {tag: ['@abac', '@team_membership']}, () => {
    test.setTimeout(120000);

    let createdTeamIds: string[] = [];
    let createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds) {
            try {
                await adminClient.deleteTeam(id);
            } catch {
                // ignore
            }
        }
        createdTeamIds = [];
        for (const id of createdUserIds) {
            try {
                await adminClient.updateUserActive(id, false);
            } catch {
                // ignore
            }
        }
        createdUserIds = [];
    });

    test('MM-69100-T8 non-qualifying user is rejected at the API level on a private ABAC team', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();

        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create private team governed by the Engineering policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Create eng1 (qualifies) and mkt1 (does not qualify)
        const makeUser = async (dept: string, label: string) => {
            const uid = `${label}${suffix}`;
            const user = await adminClient.createUser(
                {
                    email: `${uid}@sample.mattermost.com`,
                    username: uid,
                    password: newTestPassword(),
                } as any,
                '',
                '',
            );
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };
        const eng1 = await makeUser('Engineering', 'eng1gate');
        const mkt1 = await makeUser('Marketing', 'mkt1gate');
        createdUserIds.push(eng1.id, mkt1.id);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        // Wait for the materialized view to reflect both users before hitting the gate
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng1.id]);

        const token = adminClient.getToken();
        const baseRoute = adminClient.getBaseRoute();

        // * Non-qualifying user (Marketing) is rejected with 403
        const mktResult = await addTeamMemberRaw(token, baseRoute, team.id, mkt1.id);
        expect(mktResult.status).toBe(403);

        // * Error message is generic — must NOT leak policy name, attribute name or CEL expression
        const errMsg: string = mktResult.body?.message ?? '';
        expect(errMsg).not.toMatch(/Engineering/i);
        expect(errMsg).not.toMatch(/Department/i);
        expect(errMsg).not.toMatch(/policy/i);
        expect(errMsg.length).toBeGreaterThan(0);

        // * mkt1 is NOT a member of the team
        const members: any[] = await adminClient.getTeamMembers(team.id, 0, 100);
        const memberIds = members.map((m: any) => m.user_id);
        expect(memberIds).not.toContain(mkt1.id);

        // * Qualifying user (Engineering) is accepted with 201 (Created)
        const engResult = await addTeamMemberRaw(token, baseRoute, team.id, eng1.id);
        expect(engResult.status).toBe(201);

        // * eng1 is now a member
        const membersAfter: any[] = await adminClient.getTeamMembers(team.id, 0, 100);
        const memberIdsAfter = membersAfter.map((m: any) => m.user_id);
        expect(memberIdsAfter).toContain(eng1.id);
    });

    test('MM-69100-T9 non-qualifying user is allowed at the API level on a public ABAC team (advisory)', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();

        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create public team — advisory mode, same Engineering policy
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        const uid = `mkt2gate${suffix}`;
        const mkt2 = await adminClient.createUser(
            {
                email: `${uid}@sample.mattermost.com`,
                username: uid,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        await setUserAttribute(adminClient, mkt2.id, 'Department', 'Marketing');
        createdUserIds.push(mkt2.id);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const token = adminClient.getToken();
        const baseRoute = adminClient.getBaseRoute();

        // * Non-qualifying user is allowed on a public ABAC team — advisory, no gate
        const result = await addTeamMemberRaw(token, baseRoute, team.id, mkt2.id);
        expect(result.status).toBe(201);

        // * mkt2 is a member despite not matching the policy
        const members: any[] = await adminClient.getTeamMembers(team.id, 0, 100);
        const memberIds = members.map((m: any) => m.user_id);
        expect(memberIds).toContain(mkt2.id);
    });

    test('MM-69100-T10 qualifying user self-joins a private ABAC team by attribute match; non-qualifying is rejected', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();

        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team governed by the Engineering policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Two regular users (no join_private_teams role): eng qualifies, mkt does not.
        // Capture their passwords so we can log in as them and self-join.
        const makeUser = async (dept: string, label: string) => {
            const uid = `${label}${suffix}`;
            const password = newTestPassword();
            const user = await adminClient.createUser(
                {
                    email: `${uid}@sample.mattermost.com`,
                    username: uid,
                    password,
                } as any,
                '',
                '',
            );
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            createdUserIds.push(user.id);
            return {user, password};
        };
        const eng = await makeUser('Engineering', 'engself');
        const mkt = await makeUser('Marketing', 'mktself');

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng.user.id]);

        const baseRoute = adminClient.getBaseRoute();

        // # Qualifying user logs in and joins themselves with their OWN session
        const engToken = await loginRaw(baseRoute, eng.user.username, eng.password);
        expect(engToken.length).toBeGreaterThan(0);

        // * Attribute match authorizes the self-join even without the join_private_teams role
        const engResult = await addTeamMemberRaw(engToken, baseRoute, team.id, eng.user.id);
        expect(engResult.status).toBe(201);

        const members: any[] = await adminClient.getTeamMembers(team.id, 0, 100);
        expect(members.map((m: any) => m.user_id)).toContain(eng.user.id);

        // # Non-qualifying user attempts the same self-join with their own session
        const mktToken = await loginRaw(baseRoute, mkt.user.username, mkt.password);
        expect(mktToken.length).toBeGreaterThan(0);

        // * Rejected — the attribute gate applies to the requesting user's session too
        const mktResult = await addTeamMemberRaw(mktToken, baseRoute, team.id, mkt.user.id);
        expect(mktResult.status).toBe(403);

        const membersAfter: any[] = await adminClient.getTeamMembers(team.id, 0, 100);
        expect(membersAfter.map((m: any) => m.user_id)).not.toContain(mkt.user.id);
    });
});
