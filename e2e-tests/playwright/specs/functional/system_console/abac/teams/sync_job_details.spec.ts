// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Sync Job Details modal shows per-team added/removed counts and the mass-removal warning
 * @reference MM-69100
 */

import {expect, newTestPassword, test, App, duration} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPrivateTeam,
    createTeamMembershipPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {MEMBERSHIP_POLICIES_PATH} from '../surface';

import {cleanUpCreated, enableTeamMembershipPolicies, triggerSyncJobAndPoll} from './helpers';

/** Opens System Console > Membership Policies, waiting for its sync jobs section. */
async function openSyncJobs(app: App) {
    await app.page.goto(MEMBERSHIP_POLICIES_PATH);
    await expect(app.admin.accessControl.syncJobsTitleText).toBeVisible();
}

/** The most recent sync job's row (the table lists newest first). */
async function latestSyncJob(app: App) {
    const table = app.admin.jobs.table('access_control_sync');
    await expect(table.jobList).not.toHaveKeyCount(0);
    return table.job({id: (await table.jobList.keys())[0]});
}

/** Opens a sync job's details on its Teams tab. */
async function openTeamsTab(job: Awaited<ReturnType<typeof latestSyncJob>>) {
    const details = await job.viewDetailsButton.clickTo(new App(job.page).jobDetailsModal);
    await details.tab('teams').click();
    await expect(details.teams.teamList.locator).not.toHaveCount(0);
    return details.teams;
}

test.describe('ABAC - Sync Job Details Modal', {tag: ['@abac', '@team_membership']}, () => {
    test.setTimeout(duration.two_min);

    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await cleanUpCreated(adminClient, {teamIds: createdTeamIds.splice(0), userIds: createdUserIds.splice(0)});
    });

    test('MM-69100-T4 sync job details shows per-team member counts and section title', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team + active Engineering policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # The creator is auto-added; drop them so the member set is exactly the
        // # two users below — keeps the removal count deterministic and below the
        // # >50% mass-removal guardrail.
        await adminClient.removeFromTeam(team.id, adminUser.id);

        // # eng1 is a qualifying member; mkt1 is non-qualifying (will be removed by sync)
        const createUser = async (dept: string, label: string, addToTeam: boolean) => {
            const uid = `${suffix}${label}`;
            const user = await adminClient.createUser(
                {
                    email: `${uid}@sample.mattermost.com`,
                    username: uid,
                    password: newTestPassword(),
                } as any,
                '',
                '',
            );
            if (addToTeam) {
                await adminClient.addToTeam(team.id, user.id);
            }
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        const eng1 = await createUser('Engineering', `eng1${suffix}`, true);
        const mkt1 = await createUser('Marketing', `mkt1${suffix}`, true);
        createdUserIds.push(eng1.id, mkt1.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng1.id]);

        // # Active policy (strict mode removes non-qualifiers)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        // # Trigger sync and wait for completion
        await triggerSyncJobAndPoll(adminClient, team.id);

        // # Log in and open the sync jobs section
        const {app} = await pw.testBrowser.login(adminUser);
        await openSyncJobs(app);

        // * Section title is "Membership Sync Jobs"
        await expect(app.admin.accessControl.syncJobsTitleText).toHaveText(/Membership sync jobs/i);

        // # Open the most recent job's details (the channel sync chained from the team sync). The row
        // exposes a visible "View details" affordance (MM-69827 finding 12).
        const job = await latestSyncJob(app);
        await expect(job.viewDetailsButton).toBeVisible();
        const teams = await openTeamsTab(job);

        // * Our team's row shows one removal (mkt1), not enough for the mass-removal warning
        const teamRow = teams.team(team);
        await expect(teamRow).toBeVisible();
        await expect(teamRow.removedText).toHaveText(/-1/);
        await expect(teamRow.massRemovalWarning).toHaveCount(0);

        // # Click the team row to open the user drill-down
        await teamRow.container.click();
        await expect(app.userSyncModal.closeButton).toBeVisible();
    });

    test('MM-69827-T1 Membership Sync Jobs names the channel scope and points to team sync when team ABAC is on', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);

        const {app} = await pw.testBrowser.login(adminUser);
        await openSyncJobs(app);
        const {accessControl} = app.admin;

        // * Button names its scope so a green success isn't mistaken for a team re-sync
        await expect(accessControl.runSyncButton).toHaveText(/Run Channel Sync/i);

        // * The description says so too, and a note points admins to where team-membership sync actually lives
        await expect(accessControl.syncJobsDescriptionText).toContainText(/channel membership/i);
        await expect(accessControl.teamSyncNote).toContainText(/This syncs channel membership only/i);
        await expect(accessControl.teamSyncNote).toContainText(/Team Settings/i);
    });

    test('MM-69100-T5 sync job details shows mass-removal warning when >50% of members are removed', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team + active Engineering policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # The creator is auto-added; drop them so the member set is exactly the
        // # four users below (1 qualifying + 3 not), giving a clean 75% removal.
        await adminClient.removeFromTeam(team.id, adminUser.id);

        // # Add 1 qualifying member and 3 non-qualifying members so >50% are removed
        const createAndAdd = async (dept: string, label: string) => {
            const uid = `${suffix}${label}`;
            const user = await adminClient.createUser(
                {
                    email: `${uid}@sample.mattermost.com`,
                    username: uid,
                    password: newTestPassword(),
                } as any,
                '',
                '',
            );
            await adminClient.addToTeam(team.id, user.id);
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        const eng1 = await createAndAdd('Engineering', `eng${suffix}`);
        const mkt1 = await createAndAdd('Marketing', `mkt1${suffix}`);
        const mkt2 = await createAndAdd('Marketing', `mkt2${suffix}`);
        const mkt3 = await createAndAdd('Marketing', `mkt3${suffix}`);
        createdUserIds.push(eng1.id, mkt1.id, mkt2.id, mkt3.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng1.id]);

        // # Active policy — 3 of 4 members removed (75%)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        // # Trigger sync and wait for completion
        await triggerSyncJobAndPoll(adminClient, team.id);

        // # Open the most recent job's details (the channel sync chained from the team sync) on its Teams tab
        const {app} = await pw.testBrowser.login(adminUser);
        await openSyncJobs(app);
        const teams = await openTeamsTab(await latestSyncJob(app));

        // * Mass-removal warning indicator present (>50% removed)
        const teamRow = teams.team(team);
        await expect(teamRow).toBeVisible();
        await expect(teamRow.massRemovalWarning).toBeVisible();
    });
});
