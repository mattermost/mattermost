// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import {
    Api,
    duration,
    expect,
    Msg,
    settle,
    systemConsolePath,
    test,
    waitForApi,
    type App,
} from '@mattermost/playwright-lib';

import {createPrivateTeam, getTeamAutoAddMode} from '../../../channels/team_settings/helpers';

import {
    assignTeamsToPolicy,
    cleanUpCreated,
    createTeamMembershipParentPolicy,
    enableTeamMembershipPolicies,
} from './helpers';

/**
 * ABAC — Team Membership (per-team System Console page)
 *
 * Covers the System Console > User Management > Teams > [Team] "Team Management"
 * surface added for team membership policies: the attribute-based access toggle,
 * linking/removing a parent policy, the group-sync mutual-exclusivity affordance,
 * the empty state, and the policy-list "Applies to" team count.
 *
 * Enforcement and sync (removal/auto-add) are exercised by the join/sync specs;
 * these tests assert the console management UI and the resulting server state
 * (team.policy_enforced) only.
 */
test.describe('ABAC - Team Membership console', {tag: ['@abac', '@team_membership']}, () => {
    // Each test cleans up the policies, teams, and users it creates, even on
    // failure. initSetup's team/users are owned by the framework and left alone.
    let cleanupClient: Client4 | undefined;
    const createdPolicyIds: string[] = [];
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async () => {
        const client = cleanupClient;
        cleanupClient = undefined;
        const policyIds = createdPolicyIds.splice(0);
        const teamIds = createdTeamIds.splice(0);
        const userIds = createdUserIds.splice(0);
        if (!client) {
            return;
        }
        await cleanUpCreated(client, {policyIds, teamIds, userIds});
    });

    /**
     * Opens a team's page in the System Console and waits for its membership policy to load: the page fetches it on
     * mount, and a response landing after the toggle is switched on would switch it back off.
     */
    async function openTeamConfig(app: App, team: Team) {
        await Promise.all([
            waitForApi(app.page, Api.GetTeamAccessControlPolicy, {params: {team_id: team.id}}),
            app.page.goto(systemConsolePath(`user_management/teams/${team.id}`)),
        ]);
        await expect(app.admin.team.policyEnforce.container).toBeVisible();
        return app.admin.team;
    }

    /** Whether a team sync job for this team was created since `since`. */
    async function teamSyncJobSince(client: Client4, team: {id: string}, since: number) {
        const jobs: any[] = await (client as any).doFetch(
            `${client.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        return jobs.some((j: any) => j.data?.policy_id === team.id && j.create_at >= since);
    }

    /**
     * @objective Clicking "Sync now" in the Team-specific membership rules panel of the
     * Team Details admin page enqueues an access_control_team_sync job scoped
     * to the team.
     */
    test('MM-68846-T17 - clicking "Sync now" in Team Details Team-specific membership rules panel enqueues a team sync job', async ({
        pw,
    }) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A team already governed by a saved policy so the sync footer is offered.
        const policyName = `Sync Now Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const {syncStatus} = page.accessRules;
        await expect(page.accessRules).toBeVisible();
        await expect(syncStatus).toBeVisible();
        await expect(syncStatus.syncNowButton).toBeVisible();

        const testStartTime = Date.now();

        // # Click "Sync now" inside the Team-specific membership rules panel
        await syncStatus.syncNowButton.click();

        // * A new team sync job scoped to this team is enqueued
        await expect
            .poll(async () => teamSyncJobSince(adminClient, team, testStartTime), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 3000],
                message: 'clicking Sync now in Team Details should enqueue a team sync job for this team',
            })
            .toBe(true);
    });

    /**
     * @objective The System Console Teams list distinguishes a policy-governed team from a
     * plain invite-only team: its Management column reads "Attribute Based", not "Invite Only".
     */
    test('MM-68846-T18 - Teams list shows an Attribute Based indicator for a policy-governed team', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A private team governed by a membership policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const policyName = `Indicator Policy ${suffix}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.page.goto(systemConsolePath('user_management/teams'));
        const {teams} = app.admin;

        // # Search for the team
        await settle(teams.searchTextbox, {wait: Api.SearchTeams}).fill(team.display_name);

        // * The governed team's Management cell reads "Attribute Based", not "Invite Only"
        await expect(teams.row(team.id).cell('management')).toHaveText('Attribute Based');
    });

    /**
     * @objective Opening a linked policy in the editor from the team page and navigating
     * back does not raise a spurious "Discard Changes?" prompt for the team page's leftover
     * unsaved state — the editor clears the stale navigation-block flag on entry.
     */
    test('MM-68846-T19 - opening a policy in the editor does not carry over a false discard prompt', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Editor Nav Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const linked = page.accessPolicy.policy(policy);
        await expect(linked.nameText).toHaveText(policyName, {timeout: duration.half_min});

        // # Stage a team-page edit so the navigation-block flag is set, then open the
        // # linked policy in the editor (a plain link that never resets that flag).
        // The auto-add checkbox is reachable because the team is governed by a parent policy.
        await page.autoAddMembersCheckbox.check();
        await expect(page.autoAddMembersCheckbox).toBeChecked();
        await linked.openLink.click();

        // * The policy editor loads
        await expect(app.page).toHavePath(
            systemConsolePath(`system_attributes/membership_policies/edit_policy/${policy.id}`),
            {
                timeout: duration.half_min,
            },
        );
        await expect(app.admin.header).toContainMessage(Msg.admin.access_control.policy.edit_policy.title);

        // # Navigate back via the editor's back arrow
        await app.admin.accessControl.policy.backLink.click();

        // * No spurious discard prompt, and we land on the Membership Policies list
        await expect(app.discardChangesModal).toHaveCount(0);
        await expect(app.page).toHavePath(systemConsolePath('system_attributes/membership_policies'));
        await expect(app.admin.accessControl.policies.searchTextbox).toBeVisible();
    });

    /**
     * @objective The Membership policies table exposes only Policy Name and Actions —
     * auto-add is a single team-level flag owned by the rules section, not a per-policy
     * column, so the table carries no auto-add checkbox. The rules section is titled
     * "Team-specific membership rules".
     */
    test('MM-68846-T21 - membership policies table has no auto-add column and the rules section is renamed', async ({
        pw,
    }) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Table Layout Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const {accessPolicy} = page;
        await expect(accessPolicy.policy(policy).nameText).toHaveText(policyName, {timeout: duration.half_min});

        // * The header row has Policy Name and Actions, but no Auto-add column
        await expect(accessPolicy.header).toContainMessage(
            Msg.admin.team_settings.team_detail.access_control_policy_name,
        );
        await expect(accessPolicy.header).toContainMessage(
            Msg.admin.team_settings.team_detail.access_control_policy_actions,
        );
        await expect(accessPolicy.header).not.toContainText('Auto-add');

        // * No per-policy auto-add checkbox lives in the policy panel
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the absence of any checkbox role in the policy list is the thing under test, and a control that is not there has no test id
        await expect(accessPolicy.container.locator.getByRole('checkbox')).toHaveCount(0);

        // * The rules section carries the renamed title
        await expect(page.accessRules.titleText).toHaveMessage(Msg.admin.team_settings.team_detail.rules.title);
    });

    /**
     * @objective A team governed only by an imported parent policy (no custom rule) can
     * still toggle auto-add — the rules-section checkbox is enabled even with an empty
     * custom expression — and toggling it persists the auto-add mode on the team child
     * policy's membership rule.
     */
    test('MM-68846-T22 - auto-add is interactive for a parent-only team and persists on save', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A parent-governed team with no custom rule (assigned inactive by default).
        const policyName = `Parent Only Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        await expect(page.accessRules).toBeVisible();

        const autoAddCheckbox = page.autoAddMembersCheckbox;

        // * Enabled purely because a parent policy governs the team (no custom expression),
        // * and off to start.
        await expect(autoAddCheckbox).toBeEnabled();
        await expect(autoAddCheckbox).not.toBeChecked();

        // # Turn auto-add on and save. Enabling auto-add backfills matching non-members,
        // # so the save raises the confirmation previewing the impact (UX spec §4.4).
        await autoAddCheckbox.check();
        await expect(autoAddCheckbox).toBeChecked();
        await page.savePanel.saveButton.click();
        const confirmModal = page.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: duration.half_min});
        await expect(confirmModal.confirmButton).toHaveText(/Apply/);
        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible();

        // * The team child policy's membership rule now carries the auto-add mode
        await expect
            .poll(async () => getTeamAutoAddMode(adminClient, team.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team child policy auto-add mode should persist after enabling auto-add',
            })
            .toBe('always');
    });
});
