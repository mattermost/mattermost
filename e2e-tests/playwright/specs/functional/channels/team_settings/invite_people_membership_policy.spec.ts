// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Invite People modal enforces and displays team membership policy
 * @reference MM-69100
 */

import {expect, ignoreMissing, newTestPassword, test, type App, duration} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createPrivateTeam,
    createTeamMembershipPolicy,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from './helpers';
import {openTeam} from './surface';

/** Opens Invite People from the team menu. */
async function openInvitePeople(app: App) {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.invitePeopleMenuItem);
    const modal = await app.lhs.teamMenu.invitePeopleMenuItem.clickTo(app.invitationModal);
    await expect(modal).toBeVisible();
    await expect(modal.invite.users.inputCombobox).toBeVisible();
    return modal;
}

test.describe('Invite People - Team Membership Policy', {tag: ['@abac', '@team_membership']}, () => {
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds.splice(0)) {
            await ignoreMissing(() => adminClient.deleteTeam(id));
        }
        for (const id of createdUserIds.splice(0)) {
            await ignoreMissing(() => adminClient.updateUserActive(id, false));
        }
    });

    test('MM-69100_30 governed team shows the policy banner, attribute chips, and invite-link warning', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Create policy (advisory/public team)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const app = await openTeam(pw, teamAdmin, team);

        // # Open Invite People modal
        const {invite} = await openInvitePeople(app);

        // * Policy banner visible with correct title
        const banner = invite.policyBannerStatus;
        await expect(banner).toBeVisible();
        await expect(banner).toContainText('Team access is restricted by user attributes');

        // * Attribute chips are shown (async — wait on the chip text)
        await expect(banner).toContainText(/Department:/i, {timeout: duration.half_min});

        // * Invite-link warning visible
        const linkWarning = invite.linkWarningStatus;
        await expect(linkWarning).toBeVisible();
        await expect(linkWarning).toHaveText(/People who use this link must meet the membership requirements to join/i);
    });

    test('MM-69100_31 PRIVATE governed team filters the candidate list to qualifying users only (strict)', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        const userPrefix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a private team
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # eng1 and mkt1 share userPrefix so one search term finds both — usernames are @{userPrefix}eng and @{userPrefix}mkt
        const createUser = async (dept: string, tag: string) => {
            const uid = `${userPrefix}${tag}`;
            const user = await adminClient.createUser(
                {email: `${uid}@sample.mattermost.com`, username: uid, password: newTestPassword()} as any,
                '',
                '',
            );
            user.password = newTestPassword();
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        const eng1 = await createUser('Engineering', 'eng');
        const mkt1 = await createUser('Marketing', 'mkt');
        createdUserIds.push(eng1.id, mkt1.id);

        // # Policy applied — strict mode (private team)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        // The child policy row is written to the master DB; reads may go to a
        // read replica. Poll until policy_enforced=true before opening the modal
        // so isStrictlyFilteredTeam() is correct at componentDidMount.
        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.one_min,
                intervals: [1000, 2000, 5000, 5000, 5000],
                message: 'team should show policy_enforced=true before opening the invite modal',
            })
            .toBe(true);

        // Confirm the attribute view is fresh AFTER policy_enforced is set. Placing this
        // wait here (not before createTeamMembershipPolicy) keeps the gap between the
        // confirmed view and the actual invite search to login+nav time (~8–11s), well
        // inside the 30s materialized-view refresh cycle. The original position before
        // policy creation left a 20–30s gap that reliably landed on the next refresh
        // boundary — causing the strict filter to read a mid-refresh (empty) view and
        // exclude eng1 from the results.
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [
            eng1.id,
            teamAdmin.id,
        ]);

        const app = await openTeam(pw, teamAdmin, team);

        // # Open Invite People
        const {invite} = await openInvitePeople(app);

        // The modal container is visible before the team policy fetch completes.
        // Wait for the policy banner — it only renders after the async policy fetch
        // returns — so that strict filtering is active before we search.  Typing
        // before this resolves causes the first search to fire in non-strict mode;
        // strict mode then activates mid-search and clears the results.
        await expect(invite.policyBannerStatus).toBeVisible({timeout: duration.half_min});

        // # Search with the shared prefix to surface both users (strict filter will keep only qualifiers)
        await invite.users.inputCombobox.press('ArrowDown');
        await expect(invite.users.inputCombobox).toHaveAttribute('aria-expanded', 'true');
        await invite.users.inputCombobox.type(userPrefix);

        // * eng1 is an option (qualifies — Department=Engineering)
        await expect(invite.users.user(eng1)).toBeVisible({timeout: duration.half_min});

        // * mkt1 is NOT in the list at all (strict filtering strips non-qualifiers from the DOM)
        await expect(invite.users.user(mkt1)).toHaveCount(0);
    });

    test('MM-69100_32 PUBLIC governed team does NOT filter candidates (advisory)', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a public team
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # eng1 and mkt1 share userPrefix so one search surfaces both — advisory mode must show both
        const userPrefix = pw.random.id();
        const createUser = async (dept: string, tag: string) => {
            const uid = `${userPrefix}${tag}`;
            const user = await adminClient.createUser(
                {email: `${uid}@sample.mattermost.com`, username: uid, password: newTestPassword()} as any,
                '',
                '',
            );
            user.password = newTestPassword();
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        const eng1 = await createUser('Engineering', 'eng');
        const mkt1 = await createUser('Marketing', 'mkt');
        createdUserIds.push(eng1.id, mkt1.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng1.id]);

        // # Advisory policy (public team)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const app = await openTeam(pw, teamAdmin, team);

        // # Open Invite People
        const {invite} = await openInvitePeople(app);

        // * Banner still shown (governed) but with softened advisory copy
        const banner = invite.policyBannerStatus;
        await expect(banner).toBeVisible();
        await expect(banner).toContainText('This team has membership requirements');
        await expect(banner).toContainText(/can still join, but will not be automatically added/i);
        // The same visible banner must omit the strict-enforcement title
        await expect(banner).not.toContainText('Team access is restricted by user attributes');

        // * Invite-link warning uses the advisory wording (no join block)
        const linkWarning = invite.linkWarningStatus;
        await expect(linkWarning).toHaveText(/can join even if they do not meet the membership requirements/i);

        // # Search with the shared prefix to surface both users
        await invite.users.inputCombobox.type(userPrefix);

        // * Both eng1 AND mkt1 appear (advisory = no filtering)
        await expect(invite.users.user(eng1)).toBeVisible({timeout: duration.half_min});
        await expect(invite.users.user(mkt1)).toBeVisible({timeout: duration.half_min});
    });

    test('MM-69100_33 non-policy team behaves normally (regression)', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        const app = await openTeam(pw, teamAdmin, team);

        // # Open Invite People
        const {invite} = await openInvitePeople(app);

        // * Policy banner NOT present
        await expect(invite.policyBannerStatus).not.toBeVisible();

        // * Normal invite input present
        await expect(invite.users.inputCombobox).toBeVisible();
    });

    test('MM-69100_34 PRIVATE governed team narrows candidates by the typed term server-side', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        const userPrefix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private (strict) team governed by a policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # Two qualifying (Engineering) users sharing a prefix but with distinct
        // # suffixes, so a suffix-specific term matches exactly one of them. Since
        // # the strict picker searches server-side (no pre-buffered candidate set),
        // # the non-matching qualifier must be excluded by the term, not surfaced.
        const createEngUser = async (tag: string) => {
            const uid = `${userPrefix}eng${tag}`;
            const user = await adminClient.createUser(
                {email: `${uid}@sample.mattermost.com`, username: uid, password: newTestPassword()} as any,
                '',
                '',
            );
            await setUserAttribute(adminClient, user.id, 'Department', 'Engineering');
            return user;
        };

        const engAlpha = await createEngUser('alpha');
        const engBeta = await createEngUser('beta');
        createdUserIds.push(engAlpha.id, engBeta.id);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.one_min,
                intervals: [1000, 2000, 5000, 5000, 5000],
                message: 'team should show policy_enforced=true before opening the invite modal',
            })
            .toBe(true);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [
            engAlpha.id,
            engBeta.id,
            teamAdmin.id,
        ]);

        const app = await openTeam(pw, teamAdmin, team);

        // # Open Invite People
        const {invite} = await openInvitePeople(app);
        await expect(invite.policyBannerStatus).toBeVisible({timeout: duration.half_min});

        // # Search a term that matches only engAlpha
        await invite.users.inputCombobox.press('ArrowDown');
        await expect(invite.users.inputCombobox).toHaveAttribute('aria-expanded', 'true');
        await invite.users.inputCombobox.type(`${userPrefix}engalpha`);

        // * engAlpha is returned by the server-side policy-scoped search
        await expect(invite.users.user(engAlpha)).toBeVisible({timeout: duration.half_min});

        // * engBeta — also a qualifier — is excluded by the term, proving the
        //   search is applied server-side rather than dumping a buffered set
        await expect(invite.users.user(engBeta)).toHaveCount(0);
    });
});
