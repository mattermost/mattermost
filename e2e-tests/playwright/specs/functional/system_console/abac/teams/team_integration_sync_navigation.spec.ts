// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {duration, expect, systemConsolePath, test, type App} from '@mattermost/playwright-lib';

import {createPrivateTeam, getTeamAutoAddMode} from '../../../channels/team_settings/helpers';

import {
    assignTeamsToPolicy,
    createTeamMembershipParentPolicy,
    enableTeamMembershipPolicies,
    openTeamConfig,
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
/** The team form's rules have no declared ancestor; locate its body, the page's one content wrapper. */
function teamContent(app: App) {
    // The content wrapper has no test id.
    return app.page.locator('.admin-console__content');
}

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
        const {page} = app;
        const policyFetchDoneT17 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT17;

        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        // The sync footer has no generated parts; inspect its status and link within the rules panel.
        const syncFooter = rulesPanel.locator('.SyncStatusFooter');
        await expect(syncFooter).toBeVisible();
        // The sync footer has no generated parts; inspect its status and link within the rules panel.
        await expect(syncFooter.locator('.SyncStatusFooter__link')).toBeVisible();

        const testStartTime = Date.now();

        // # Click "Sync now" inside the Team-specific membership rules panel
        // The sync footer has no generated parts; inspect its status and link within the rules panel.
        await syncFooter.locator('.SyncStatusFooter__link').click();

        // * A new team sync job scoped to this team is enqueued
        await expect
            .poll(
                async () => {
                    const jobs: any[] = await (adminClient as any).doFetch(
                        `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                        {method: 'GET'},
                    );
                    return jobs.some((j: any) => j.data?.policy_id === team.id && j.create_at >= testStartTime);
                },
                {
                    timeout: duration.half_min,
                    intervals: [500, 1000, 2000, 3000],
                    message: 'clicking Sync now in Team Details should enqueue a team sync job for this team',
                },
            )
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
        const {page} = app;

        await page.goto(systemConsolePath('user_management/teams'));
        await page.waitForLoadState('networkidle');

        // Wait on the debounced server-side search rather than a fixed sleep.
        const searchDone = page
            .waitForResponse((resp) => resp.url().includes('/teams/search'), {timeout: duration.half_min})
            .catch(() => {});
        const search = app.admin.teams.searchTextbox;
        await search.fill(team.display_name);
        await expect(search).toHaveValue(team.display_name);
        await searchDone;

        // * The governed team's Management cell reads "Attribute Based", not "Invite Only"
        const management = app.admin.teams.row(team.id).managementText.locator;
        await expect(management).toBeVisible();
        await expect(management).toHaveText('Attribute Based');
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
        const {page} = app;
        const policyFetchDoneT19 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT19;

        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their ids, classes and accessible names.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({
            timeout: duration.half_min,
        });

        // # Stage a team-page edit so the navigation-block flag is set, then open the
        // # linked policy in the editor (a plain link that never resets that flag).
        // The auto-add checkbox is reachable because the team is governed by a parent policy.
        await app.admin.team.autoAddMembersCheckbox.check();
        await expect(app.admin.team.autoAddMembersCheckbox).toBeChecked();
        await policyPanel.getByLabel('Go to the policy').click();

        // * The policy editor loads
        await expect(page).toHaveURL(/membership_policies\/edit_policy\//, {timeout: duration.half_min});
        // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their ids, classes and accessible names.
        await expect(app.admin.header.locator.getByText('Edit Membership Policy')).toBeVisible();

        // # Navigate back via the editor's back arrow
        // The admin back link has no generated part; its icon class is scoped to the declared header.
        await app.admin.header.locator.locator('.fa.fa-angle-left.back').click();

        // * No spurious discard prompt, and we land on the Membership Policies list
        await expect(page.getByText('Discard Changes?')).toHaveCount(0);
        await expect(page).toHaveURL(/membership_policies$/);
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
        const {page} = app;
        const policyFetchDoneT21 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT21;

        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their ids, classes and accessible names.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({
            timeout: duration.half_min,
        });

        // * The header row has Policy Name and Actions, but no Auto-add column
        const header = policyPanel.locator('.team-policy-list__header');
        await expect(header.getByText('Policy Name')).toBeVisible();
        await expect(header.getByText('Actions')).toBeVisible();
        await expect(header.getByText('Auto-add', {exact: true})).toHaveCount(0);

        // * No per-policy auto-add checkbox lives in the policy list rows
        await expect(policyPanel.locator('.team-policy-list input[type="checkbox"]')).toHaveCount(0);

        // * The rules section carries the renamed title
        // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their ids, classes and accessible names.
        await expect(
            teamContent(app).locator('#team_level_access_rules').getByText('Team-specific membership rules'),
        ).toBeVisible();
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
        const {page} = app;
        const policyFetchDoneT22 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT22;

        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        const autoAddCheckbox = app.admin.team.autoAddMembersCheckbox;

        // * Enabled purely because a parent policy governs the team (no custom expression),
        // * and off to start.
        await expect(autoAddCheckbox).toBeEnabled();
        await expect(autoAddCheckbox).not.toBeChecked();

        // # Turn auto-add on and save. Enabling auto-add backfills matching non-members,
        // # so the save raises the confirmation previewing the impact (UX spec §4.4).
        await autoAddCheckbox.check();
        await expect(autoAddCheckbox).toBeChecked();
        await app.admin.team.savePanel.saveButton.click();
        const confirmModal = app.admin.team.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: duration.half_min});
        await expect(confirmModal.confirmButton).toHaveText(/Apply/);
        await confirmModal.confirmButton.click();
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
