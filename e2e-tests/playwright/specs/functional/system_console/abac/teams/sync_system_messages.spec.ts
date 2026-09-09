// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective A real team sync job creates the addition/removal system posts, which are
 * rendered correctly in the affected user's DM from the system bot.
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
} from '../../../channels/team_settings/helpers';

import {enableTeamMembershipPolicies, triggerSyncJobAndPoll} from './helpers';

const SYSTEM_BOT_USERNAME = 'system-bot';

test.describe('ABAC - Sync System Messages', {tag: ['@abac', '@team_membership']}, () => {
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

    test('MM-69100-T6 qualifying non-member receives an addition DM after a sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Public team + active Engineering policy
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Create joiner with Engineering attribute — NOT yet a team member
        const joinerUid = `joiner${suffix}`;
        const joinerPassword = newTestPassword();
        const joiner = await adminClient.createUser(
            {
                email: `${joinerUid}@sample.mattermost.com`,
                username: joinerUid,
                password: joinerPassword,
            } as any,
            '',
            '',
        );
        createdUserIds.push(joiner.id);
        await setUserAttribute(adminClient, joiner.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [joiner.id]);

        // # Active policy — auto-add will add joiner on next sync
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        // # Trigger sync and wait for it to complete
        await triggerSyncJobAndPoll(adminClient);

        // * joiner is now a team member
        const members: any[] = await adminClient.getTeamMembers(team.id);
        const joinerMember = members.find((m: any) => m.user_id === joiner.id);
        expect(joinerMember).toBeDefined();

        // # Locate the system-bot user
        const botUsers: any[] = await adminClient.getProfilesByUsernames([SYSTEM_BOT_USERNAME]);
        expect(botUsers.length).toBeGreaterThan(0);
        const systemBot = botUsers[0];

        // # Get or create the DM channel between joiner and system-bot
        const dmChannel = await adminClient.createDirectChannel([joiner.id, systemBot.id]);
        expect(dmChannel).toBeDefined();

        // # Log in as joiner and navigate to the DM
        const joinerWithPassword = {...joiner, password: joinerPassword};
        const {page} = await pw.testBrowser.login(joinerWithPassword);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, dmChannel.name);
        await channelsPage.toBeVisible();

        // * Addition system message rendered in the DM (scoped to this run's team name
        // to avoid matching accumulated messages from prior test runs in the same DM).
        const escapedName = team.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const expectedText = new RegExp(
            `You have been added to ${escapedName} because you now meet the membership requirements`,
            'i',
        );
        await expect(page.locator('.post--system__access-control').filter({hasText: expectedText})).toBeVisible({
            timeout: 15000,
        });
    });

    test('MM-69100-T7 removed member receives a removal DM after a sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team + active Engineering policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # A second, non-governed team that mkt1 keeps after being removed from the
        // governed one. A user with zero teams lands on a "Team Not Found" page and
        // can't reach the system-bot DM, so they need a team context to view it.
        const homeTeam = await createPublicTeam(adminClient, `home${suffix}`);
        createdTeamIds.push(homeTeam.id);

        // # mkt1 has Marketing — does not match Engineering rule; IS a current member
        const mkt1Uid = `mkt1${suffix}`;
        const mkt1Password = newTestPassword();
        const mkt1 = await adminClient.createUser(
            {
                email: `${mkt1Uid}@sample.mattermost.com`,
                username: mkt1Uid,
                password: mkt1Password,
            } as any,
            '',
            '',
        );
        createdUserIds.push(mkt1.id);
        await adminClient.addToTeam(team.id, mkt1.id);
        await adminClient.addToTeam(homeTeam.id, mkt1.id);
        await setUserAttribute(adminClient, mkt1.id, 'Department', 'Marketing');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Marketing"', [mkt1.id]);

        // # Active policy (strict) — mkt1 will be removed
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        await triggerSyncJobAndPoll(adminClient, team.id);

        // * mkt1 is no longer a team member
        const members: any[] = await adminClient.getTeamMembers(team.id);
        const mkt1Member = members.find((m: any) => m.user_id === mkt1.id);
        expect(mkt1Member).toBeUndefined();

        // # Ensure the DM channel between mkt1 and system-bot exists before logging in
        const botUsers: any[] = await adminClient.getProfilesByUsernames([SYSTEM_BOT_USERNAME]);
        const systemBot = botUsers[0];
        const dmChannel = await adminClient.createDirectChannel([mkt1.id, systemBot.id]);

        // # Log in as mkt1 and open the system-bot DM from the retained team's context
        const mkt1WithPassword = {...mkt1, password: mkt1Password};
        const {page} = await pw.testBrowser.login(mkt1WithPassword);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(homeTeam.name, dmChannel.name);
        await channelsPage.toBeVisible();

        // * Removal system message rendered (scoped to this run's team name).
        const escapedName = team.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const expectedText = new RegExp(
            `You have been removed from ${escapedName} because you no longer meet the membership requirements`,
            'i',
        );
        await expect(page.locator('.post--system__access-control').filter({hasText: expectedText})).toBeVisible({
            timeout: 15000,
        });
    });
});
