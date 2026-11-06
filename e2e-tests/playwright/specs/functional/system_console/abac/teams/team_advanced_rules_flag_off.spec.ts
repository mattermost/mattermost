// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective The team membership rules section (and its Advanced editor) is hidden when the
 *            TeamMembershipAccessControl feature flag is off, even with ABAC enabled.
 * @reference MM-71104
 *
 * Separate file: a different flag value restarts the server.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {createPrivateTeam} from '../../../channels/team_settings/helpers';

import {openTeamConfig} from './helpers';

test.describe('ABAC - Team Advanced membership rules (flag off)', {tag: ['@abac', '@team_membership']}, () => {
    const createdTeamIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds.splice(0)) {
            await adminClient.deleteTeam(id).catch(() => {});
        }
    });

    test('MM-71104-T15c the ABAC section is hidden when the team membership flag is off', async ({pw}) => {
        test.setTimeout(180_000);
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('TeamMembershipAccessControl', false);

        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}} as any);

        const team = await createPrivateTeam(adminClient, pw.random.id());
        createdTeamIds.push(team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        await openTeamConfig(page, team.display_name);

        await expect(page.locator('[data-testid="policy-enforce-toggle-button"]')).toHaveCount(0);
        await expect(page.locator('#team_level_access_rules')).toHaveCount(0);
    });
});
