// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Sync Job Details modal shows per-team added/removed counts and the mass-removal warning
 * @reference MM-69100
 */

import {expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPrivateTeam,
    createTeamMembershipPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

import {enableTeamMembershipPolicies, triggerSyncJobAndPoll} from './helpers';

test.describe('ABAC - Sync Job Details Modal', {tag: ['@abac', '@team_membership']}, () => {
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

        // # Log in and navigate to sync jobs page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');

        // * Section title is "Membership sync jobs" (capital S verified in en.json)
        await expect(page.getByText(/Membership sync jobs/i)).toBeVisible({timeout: 10000});

        // # Open the most recent job's details (the channel sync chained from the team sync)
        const jobRow = page.locator('.job-table__access-control tr.clickable').first();
        await expect(jobRow).toBeVisible({timeout: 10000});
        await jobRow.click();

        const detailsModal = page.locator('#job-details-modal');
        await expect(detailsModal).toBeVisible({timeout: 15000});

        // # Switch to the Teams tab where the team membership changes are surfaced
        await detailsModal.getByRole('button', {name: 'Teams'}).click();

        // * Team row present for our team
        const teamRow = page.getByTestId(`TeamRow-${team.name}`);
        await expect(teamRow).toBeVisible({timeout: 10000});

        // * Removed count shows -1 (mkt1 removed)
        await expect(teamRow.locator('.changes-cell .removed')).toHaveText(/-1/);

        // # Click team row to open the user drill-down modal
        await teamRow.click();
        await expect(page.locator('#user-list-modal-dialog')).toBeVisible({timeout: 10000});
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

        // # Navigate to sync jobs page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');

        // # Open the most recent job's details (the channel sync chained from the team sync)
        const jobRow = page.locator('.job-table__access-control tr.clickable').first();
        await expect(jobRow).toBeVisible({timeout: 10000});
        await jobRow.click();

        const detailsModal = page.locator('#job-details-modal');
        await expect(detailsModal).toBeVisible({timeout: 15000});

        // # Switch to the Teams tab where the team membership changes are surfaced
        await detailsModal.getByRole('button', {name: 'Teams'}).click();

        const teamRow = page.getByTestId(`TeamRow-${team.name}`);
        await expect(teamRow).toBeVisible({timeout: 10000});

        // * Mass-removal warning indicator present (>50% removed)
        await expect(teamRow.locator('.mass-removal-warning')).toBeVisible({timeout: 10000});
    });
});
