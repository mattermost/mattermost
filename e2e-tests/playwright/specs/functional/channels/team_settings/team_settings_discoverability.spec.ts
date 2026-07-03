// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings - Access Tab discoverability (Public/Private cards)
 * @reference MM-69100
 */

import {ChannelsPage, expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createPrivateTeam,
    createTeamMembershipPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from './helpers';

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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // * Public and Private cards are visible
        await expect(teamSettings.container.getByText('Public Team')).toBeVisible();
        await expect(teamSettings.container.getByText('Private Team')).toBeVisible();

        // * Old open-invite checkboxes are gone
        await expect(teamSettings.container.locator('input[name="allowOpenInvite"]')).not.toBeVisible();

        await teamSettings.close();
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
        // No policy attached, so the cards must follow the legacy contract.
        const team = await adminClient.createTeam({
            name: `np-pub-team-${suffix}`,
            display_name: `NP Pub Team ${suffix}`,
            type: 'O',
            allow_open_invite: false,
        } as any);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // * Private Team card is initially selected (not discoverable)
        await expect(teamSettings.container.locator('#public-private-selector-button-P')).toHaveClass(/selected/);

        // # Click Public Team card
        await teamSettings.container.locator('#public-private-selector-button-O').click();
        await expect(teamSettings.saveButton).toBeVisible();
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

        // * Only allow_open_invite changed; type stays "O" (no normalization without a policy)
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(true);
        expect(updatedTeam.type).toBe('O');

        await teamSettings.close();
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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings (team is public)
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // * Public Team card is initially selected
        await expect(teamSettings.container.locator('#public-private-selector-button-O')).toHaveClass(/selected/);

        // # Click Private Team card (no policy → no mode-flip modal)
        await teamSettings.container.locator('#public-private-selector-button-P').click();
        await expect(teamSettings.saveButton).toBeVisible();
        await expect(page.getByText('Switch to Private Team?')).not.toBeVisible();
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

        // * Only allow_open_invite changed; type stays "O" — the legacy contract must not
        // flip a non-policy team to invite-only (would regress getInviteInfo, etc.)
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.allow_open_invite).toBe(false);
        expect(updatedTeam.type).toBe('O');

        await teamSettings.close();
    });

    test('MM-69100_4 team with active ABAC policy shows disabled cards with policy notice', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // initSetup creates type='O' but allow_open_invite=false; make the team
        // fully public so isPublicTeam=true and the disabled logic activates.
        await adminClient.patchTeam({id: team.id, allow_open_invite: true} as any);

        // # Create a team membership policy with auto-add ON (makes team policy_enforced + policy_is_active)
        await createTeamMembershipPolicy(adminClient, team.id, 'true', true);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings (team fetched with policy_enforced=true)
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // * Policy notice is visible
        await expect(teamSettings.container.getByText(/This team's membership is managed by a policy/i)).toBeVisible();

        // * Cards have the disabled CSS class (not HTML disabled — clicks are suppressed in JS)
        await expect(teamSettings.container.locator('#public-private-selector-button-O')).toHaveClass(/disabled/);
        await expect(teamSettings.container.locator('#public-private-selector-button-P')).toHaveClass(/disabled/);

        await teamSettings.close();
    });

    test('MM-69100_5 Public→Private mode-flip with active policy shows confirm modal with member count', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser, team} = await setupModeFlipScenario(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // * Public Team card is initially selected
        await expect(teamSettings.container.locator('#public-private-selector-button-O')).toHaveClass(/selected/);

        // # Click Private Team card → mode-flip modal should appear (policy is enforced)
        await teamSettings.container.locator('#public-private-selector-button-P').click();

        // * Mode-flip confirm modal appears
        const modeFlipModal = page.locator('.ConfirmModal').filter({hasText: 'Switch to Private Team?'});
        await expect(modeFlipModal).toBeVisible({timeout: 30000});

        // * Modal shows the member count (1 marketing user does not meet the Engineering rule)
        await expect(modeFlipModal.getByText(/1 current member does not meet/i)).toBeVisible({timeout: 10000});

        // * Switch to Private and Cancel buttons are present
        await expect(modeFlipModal.getByRole('button', {name: 'Switch to Private'})).toBeVisible();
        await expect(modeFlipModal.getByRole('button', {name: 'Cancel'})).toBeVisible();

        // # Cancel → modal closes, team stays public
        await modeFlipModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(modeFlipModal).not.toBeVisible({timeout: 5000});

        // * Team is still public
        const apiTeam = await adminClient.getTeam(team.id);
        expect(apiTeam.type).toBe('O');
        expect(apiTeam.allow_open_invite).toBe(true);

        await teamSettings.close();
    });

    test('MM-69100_6 mode-flip confirm saves team as Private and triggers sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser, team} = await setupModeFlipScenario(pw);
        const testStartTime = Date.now();

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // # Click Private card → mode-flip modal
        await teamSettings.container.locator('#public-private-selector-button-P').click();

        const modeFlipModal = page.locator('.ConfirmModal').filter({hasText: 'Switch to Private Team?'});
        await expect(modeFlipModal).toBeVisible({timeout: 30000});

        // # Click "Switch to Private" (creates sync job immediately)
        await modeFlipModal.getByRole('button', {name: 'Switch to Private'}).click();
        await expect(modeFlipModal).not.toBeVisible({timeout: 5000});

        // # SaveChangesPanel still visible — click Save to persist the team change
        await expect(teamSettings.saveButton).toBeVisible();
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

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

        await teamSettings.close();
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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);

        // # Navigate and open Team Settings (team is private + policy_enforced)
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // # Click Public Team card
        await teamSettings.container.locator('#public-private-selector-button-O').click();

        // * SaveChangesPanel appears immediately — no mode-flip modal
        await expect(teamSettings.saveButton).toBeVisible();
        await expect(page.getByText('Switch to Private Team?')).not.toBeVisible();

        // # Save
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

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

        await teamSettings.close();
    });
});
