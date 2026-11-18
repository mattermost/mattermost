// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings - Access Tab discoverability (Public/Private cards)
 * @reference MM-69100
 */

import {Api, settle, expect, newTestPassword, test, Msg} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createPrivateTeam,
    createTeamMembershipPolicy,
    createParentMembershipPolicy,
    assignTeamToParentPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
    waitForAttributeViewToExclude,
} from './helpers';
import {closeTeamSettings, openAccessTab, openTeam, save} from './surface';

type ModeFlipScenario = {
    adminClient: any;
    adminUser: any;
    team: any;
};

async function setupModeFlipScenario(pw: any): Promise<ModeFlipScenario> {
    const {adminClient, adminUser} = await pw.getAdminClient();
    const suffix = pw.random.id();

    await enableTeamMembershipABACConfig(adminClient);
    await ensureDepartmentAttribute(adminClient);

    const team = await createPublicTeam(adminClient, suffix);

    await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

    const createUser = async (dept: string, idx: number) => {
        const uid = `${suffix}u${idx}`;
        const user = await adminClient.createUser(
            {
                email: `testuser${uid}@sample.mattermost.com`,
                username: `testuser${uid}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        await adminClient.addToTeam(team.id, user.id);
        await setUserAttribute(adminClient, user.id, 'Department', dept);
        return user;
    };

    const [eng1, eng2, eng3] = await Promise.all([
        createUser('Engineering', 1),
        createUser('Engineering', 2),
        createUser('Engineering', 3),
    ]);
    await createUser('Marketing', 4);

    await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

    await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [
        adminUser.id,
        eng1.id,
        eng2.id,
        eng3.id,
    ]);

    return {adminClient, adminUser, team};
}

test.describe('Team Settings Modal - Access Tab - Discoverability', {tag: ['@abac', '@team_membership']}, () => {
    test('MM-69100_1 renders Public Team and Private Team cards, not a checkbox', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Navigate and open Team Settings
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // * Public and Private cards are visible
        const {discoverability} = teamSettings.access;
        await expect(discoverability.publicButton).toContainMessage(Msg.team_settings.discoverability.public_title);
        await expect(discoverability.privateButton).toContainText('Private Team');

        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the absence of any checkbox role is under test: discoverability is cards, so no checkbox part exists to assert on
        await expect(discoverability.locator.getByRole('checkbox')).toHaveCount(0);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_2 non-policy team: Public card toggles allow_open_invite only, leaves type unchanged', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);

        // # Start with an open-typed team that is not discoverable (type=O, allow_open_invite=false).
        // Without a policy, the cards control allow_open_invite independently of the team type.
        const team = await adminClient.createTeam({
            name: `np-pub-team-${suffix}`,
            display_name: `NP Pub Team ${suffix}`,
            type: 'O',
            allow_open_invite: false,
        } as any);

        // # Navigate and open Team Settings
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // * Private Team card is initially selected (not discoverable)
        await expect(teamSettings.access.discoverability.privateButton).toHaveClass(/selected/);

        // # Click Public Team card
        await teamSettings.access.discoverability.publicButton.click();
        await expect(teamSettings.access.discoverability.publicButton).toHaveClass(/selected/);
        await expect(teamSettings.savePanel.saveButton).toBeVisible();
        await save(teamSettings);
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);

        // * Only allow_open_invite changed; type stays "O" (no normalization without a policy)
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(true);
        expect(updatedTeam.type).toBe('O');

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_3 non-policy team: Private card toggles allow_open_invite only, never sets type=I', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);

        // # Start with a fully public team (type=O AND allow_open_invite=true), no policy
        const team = await createPublicTeam(adminClient, suffix);

        // # Navigate and open Team Settings (team is public)
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // * Public Team card is initially selected
        await expect(teamSettings.access.discoverability.publicButton).toHaveClass(/selected/);

        // # Click Private Team card (no policy → no mode-flip modal)
        await teamSettings.access.discoverability.privateButton.click();
        await expect(teamSettings.savePanel.saveButton).toBeVisible();
        await expect(teamSettings.access.modeFlipModal).not.toBeVisible();
        await save(teamSettings);
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);

        // * Only allow_open_invite changes; type stays "O" — changing discoverability must not
        // flip a non-policy team to invite-only (would regress getInviteInfo, etc.)
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(false);
        expect(updatedTeam.type).toBe('O');

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_4 active ABAC policy leaves cards enabled and mode-flip reachable', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Make the team fully public
        await adminClient.patchTeam({id: team.id, allow_open_invite: true} as any);

        // # Attach a policy with auto-add on
        await createTeamMembershipPolicy(adminClient, team.id, 'true', true);

        // # Navigate and open Team Settings
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // * No "managed by a policy" notice is shown
        await expect(teamSettings.access).not.toContainText(/managed by a policy/i);

        // * Neither card carries the disabled CSS class
        await expect(teamSettings.access.discoverability.publicButton).not.toHaveClass(/disabled/);
        await expect(teamSettings.access.discoverability.privateButton).not.toHaveClass(/disabled/);

        // # Clicking Private opens the mode-flip confirmation (card is not blocked)
        await teamSettings.access.discoverability.privateButton.click();
        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();

        // # Back out of the flip, leaving the team public
        await modeFlipModal.cancelButton.click();
        await expect(modeFlipModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_5 Public→Private mode-flip with active policy shows confirm modal with member count', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser, team} = await setupModeFlipScenario(pw);

        // # Navigate and open Team Settings
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // * Public Team card is initially selected
        await expect(teamSettings.access.discoverability.publicButton).toHaveClass(/selected/);

        // # Click Private Team card → mode-flip modal should appear (policy is enforced)
        await teamSettings.access.discoverability.privateButton.click();

        // * Mode-flip confirm modal appears
        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();

        // * Modal shows the member count (1 marketing user does not meet the Engineering rule)
        await expect(modeFlipModal).toContainText(/1 current member does not meet/i);

        // * Switch to Private and Cancel buttons are present
        await expect(modeFlipModal.confirmButton).toHaveMessage(Msg.team_settings.mode_flip_confirm.confirm);
        await expect(modeFlipModal.cancelButton).toBeVisible();

        // # Cancel → modal closes, team stays public
        await modeFlipModal.cancelButton.click();
        await expect(modeFlipModal).not.toBeVisible();

        // * Team is still public
        const apiTeam = await adminClient.getTeam(team.id);
        expect(apiTeam.type).toBe('O');
        expect(apiTeam.allow_open_invite).toBe(true);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_6 mode-flip confirm saves team as Private and triggers sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser, team} = await setupModeFlipScenario(pw);
        const testStartTime = Date.now();

        // # Navigate and open Team Settings
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // # Click Private card → mode-flip modal
        await teamSettings.access.discoverability.privateButton.click();

        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();

        // # Click "Switch to Private" — confirming saves immediately (no second click)
        await settle(modeFlipModal.confirmButton, {wait: Api.PatchTeam}).click();
        await expect(modeFlipModal).not.toBeVisible();

        // * The save auto-completes and the panel reports success
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);

        // * Team is now private. Privacy is driven by allow_open_invite alone; the
        // feature never mutates team.type, so it stays 'O' from createPublicTeam.
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.type).toBe('O');
        expect(updatedTeam.allow_open_invite).toBe(false);

        // * A sync job was created after the mode-flip was confirmed
        const jobs: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const recentJobs = jobs.filter((j: any) => j.create_at >= testStartTime);
        expect(recentJobs.length).toBeGreaterThan(0);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_7 Private→Public flip saves directly, no modal, no sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);

        // # Start with a private team and create a policy on it
        const team = await createPrivateTeam(adminClient, suffix);
        await createTeamMembershipPolicy(adminClient, team.id, 'true', true);
        const testStartTime = Date.now();

        // # Navigate and open Team Settings (team is private + policy_enforced)
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // # Click Public Team card
        await teamSettings.access.discoverability.publicButton.click();
        await expect(teamSettings.access.discoverability.publicButton).toHaveClass(/selected/);

        // * SaveChangesPanel appears immediately — no mode-flip modal
        await expect(teamSettings.savePanel.saveButton).toBeVisible();
        await expect(teamSettings.access.modeFlipModal).not.toBeVisible();

        // # Save
        await save(teamSettings);
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);

        // * Team is now public. The feature never mutates team.type, so it stays
        // 'I' from createPrivateTeam; discoverability is driven by allow_open_invite.
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.type).toBe('I');
        expect(updatedTeam.allow_open_invite).toBe(true);

        // * No new sync job was created by this Private→Public flip
        const jobs: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const recentJobs = jobs.filter((j: any) => j.create_at >= testStartTime);
        expect(recentJobs.length).toBe(0);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_40 governed team switched public can be switched back to private', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);

        // # Private team with an auto-add-on policy
        const team = await createPrivateTeam(adminClient, suffix);
        await createTeamMembershipPolicy(adminClient, team.id, 'true', true);

        const app = await openTeam(pw, adminUser, team);

        // # Switch the team public and save
        let teamSettings = await openAccessTab(app);
        await teamSettings.access.discoverability.publicButton.click();
        await expect(teamSettings.access.discoverability.publicButton).toHaveClass(/selected/);
        await save(teamSettings);
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);
        await closeTeamSettings(teamSettings);

        // # Reopen Team Settings
        teamSettings = await openAccessTab(app);

        // * Cards are not disabled
        await expect(teamSettings.access.discoverability.publicButton).not.toHaveClass(/disabled/);
        await expect(teamSettings.access.discoverability.privateButton).not.toHaveClass(/disabled/);

        // # Switch back to private via the mode-flip modal
        await teamSettings.access.discoverability.privateButton.click();
        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();
        await settle(modeFlipModal.confirmButton, {wait: Api.PatchTeam}).click();
        await expect(modeFlipModal).not.toBeVisible();

        // Confirming saves immediately — the panel reports success on its own
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);

        // * Team is private again
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(false);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_41 mode-flip modal shows member count for a parent-policy team', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        const expression = 'user.attributes.Department == "Engineering"';

        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Public team; admin qualifies, added member does not
        const team = await createPublicTeam(adminClient, suffix);
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const mkt = await adminClient.createUser(
            {
                email: `testuser${suffix}mkt@sample.mattermost.com`,
                username: `testuser${suffix}mkt`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        await adminClient.addToTeam(team.id, mkt.id);
        await setUserAttribute(adminClient, mkt.id, 'Department', 'Marketing');

        // # Govern via a parent policy (child imports it, no own rules)
        const parent: any = await createParentMembershipPolicy(adminClient, `eng-parent-${suffix}`, expression);
        await assignTeamToParentPolicy(adminClient, parent.id, team.id);

        await waitForAttributeViewToInclude(adminClient, expression, [adminUser.id]);

        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // # Click Private → mode-flip modal
        await teamSettings.access.discoverability.privateButton.click();
        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();

        // * Modal shows the resolved count, not the generic message
        await expect(modeFlipModal).toContainText(/1 current member does not meet/i);

        await modeFlipModal.cancelButton.click();
        await expect(modeFlipModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_44 mode-flip is blocked when the admin does not meet the rules', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        const expression = 'user.attributes.Department == "Engineering"';

        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Public governed team where the admin does NOT satisfy the rule
        const team = await createPublicTeam(adminClient, suffix);
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Marketing');
        await createTeamMembershipPolicy(adminClient, team.id, expression, false);
        await waitForAttributeViewToExclude(adminClient, expression, [adminUser.id]);

        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // # Click Private Team card
        await teamSettings.access.discoverability.privateButton.click();

        // * Self-exclusion block appears; the mode-flip confirmation does not
        const selfExclusion = teamSettings.access.selfExclusionModal;
        await expect(selfExclusion).toContainMessage(Msg.team_settings.mode_flip_self_exclusion.title);
        await expect(teamSettings.access.modeFlipModal).not.toBeVisible();

        await expect(selfExclusion.confirmButton).toHaveText('Back to editing');
        await selfExclusion.confirmButton.click();
        await expect(selfExclusion).not.toBeVisible();

        // * Team is still public
        const apiTeam = await adminClient.getTeam(team.id);
        expect(apiTeam.allow_open_invite).toBe(true);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_45 Access tab shows the updated discoverability help text', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Navigate and open Team Settings
        const app = await openTeam(pw, adminUser, team);
        const teamSettings = await openAccessTab(app);

        // * Updated card-aligned help text is shown
        const description = teamSettings.access.discoverability.descriptionText.locator;
        await expect(description).toContainText(
            /Switching a team from Public to Private regenerates its invitation code/i,
        );

        // * Stale checkbox-era copy is gone
        await expect(teamSettings.access).not.toContainText(/Changing from 'Yes' to 'No'/i);

        await closeTeamSettings(teamSettings);
    });
});
