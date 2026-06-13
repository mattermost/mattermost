// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Invite People modal enforces and displays team membership policy
 * @reference MM-69100
 */

import {ChannelsPage, expect, newTestPassword, test} from '@mattermost/playwright-lib';

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

test.describe('Invite People - Team Membership Policy', {tag: ['@abac', '@team_membership']}, () => {
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds.splice(0)) {
            await adminClient.deleteTeam(id).catch(() => {});
        }
        for (const id of createdUserIds.splice(0)) {
            await adminClient.updateUserActive(id, false).catch(() => {});
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

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Invite People modal
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickInvitePeople();

        const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
        await expect(inviteModal.container).toBeVisible({timeout: 10000});

        // * Policy banner visible with correct title
        const banner = inviteModal.container.locator('.InviteView__policyBanner');
        await expect(banner).toBeVisible({timeout: 10000});
        await expect(banner.getByText('Team access is restricted by user attributes')).toBeVisible();

        // * Attribute chips are shown (async — wait on the chip text)
        await expect(inviteModal.container.getByText(/Department:/i)).toBeVisible({timeout: 15000});

        // * Invite-link warning visible
        const linkWarning = inviteModal.container.locator('.InviteView__inviteLinkWarning');
        await expect(linkWarning).toBeVisible({timeout: 10000});
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
                timeout: 60_000,
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

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Invite People
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickInvitePeople();

        const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
        await expect(inviteModal.container).toBeVisible({timeout: 10000});

        // The modal container is visible before the team policy fetch completes.
        // Wait for the policy banner — it only renders after the async policy fetch
        // returns — so that strict filtering is active before we search.  Typing
        // before this resolves causes the first search to fire in non-strict mode;
        // strict mode then activates mid-search and clears the results.
        await expect(inviteModal.container.locator('.InviteView__policyBanner')).toBeVisible({timeout: 15000});

        // # Search with the shared prefix to surface both users (strict filter will keep only qualifiers)
        await inviteModal.inviteInput.click();
        await inviteModal.inviteInput.pressSequentially(userPrefix);
        const listbox = inviteModal.container.getByRole('listbox');
        await expect(listbox).toBeVisible({timeout: 10000});

        // * eng1 is an option (qualifies — Department=Engineering)
        await expect(listbox.getByRole('option', {name: `@${eng1.username}`})).toBeVisible({timeout: 30000});

        // * mkt1 is NOT in the list at all (strict filtering strips non-qualifiers from the DOM)
        await expect(listbox.getByRole('option', {name: `@${mkt1.username}`})).not.toBeAttached();
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

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Invite People
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickInvitePeople();

        const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
        await expect(inviteModal.container).toBeVisible({timeout: 10000});

        // * Banner still shown (governed)
        await expect(inviteModal.container.locator('.InviteView__policyBanner')).toBeVisible({timeout: 10000});

        // # Search with the shared prefix to surface both users
        await inviteModal.inviteInput.pressSequentially(userPrefix);
        const listbox = inviteModal.container.getByRole('listbox');
        await expect(listbox).toBeVisible({timeout: 10000});

        // * Both eng1 AND mkt1 appear (advisory = no filtering)
        await expect(listbox.getByRole('option', {name: `@${eng1.username}`})).toBeVisible({timeout: 15000});
        await expect(listbox.getByRole('option', {name: `@${mkt1.username}`})).toBeVisible({timeout: 15000});
    });

    test('MM-69100_33 non-policy team behaves normally (regression)', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Invite People
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickInvitePeople();

        const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
        await expect(inviteModal.container).toBeVisible({timeout: 10000});

        // * Policy banner NOT present
        await expect(inviteModal.container.locator('.InviteView__policyBanner')).not.toBeVisible({timeout: 5000});

        // * Normal invite input present
        await expect(inviteModal.inviteInput).toBeVisible();
    });
});
