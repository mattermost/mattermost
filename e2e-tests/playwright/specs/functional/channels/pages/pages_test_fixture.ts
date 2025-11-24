// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test as base, expect} from '@mattermost/playwright-lib';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Client4} from '@mattermost/client';

type PagesWorkerFixtures = {
    sharedPagesSetup: {
        team: Team;
        user: UserProfile;
        adminClient: Client4;
    };
};

/**
 * Extended test fixture for pages tests that provides a shared team/user setup
 * across all tests in the pages directory.
 *
 * This reduces test execution time by creating ONE team for all pages tests
 * instead of creating a new team for each test.
 */
export const test = base.extend<{}, PagesWorkerFixtures>({
    // Worker-scoped fixture: created once per worker, shared across all pages test files
    // Extended timeout of 120 seconds to allow for server operations (team/user creation)
    sharedPagesSetup: [async ({}, use) => {
        // This is a workaround to access pw.initSetup from within the fixture
        // We need to create the setup directly using the server utilities
        const {
            getAdminClient,
            createRandomTeam,
            createRandomUser,
            getOnPremServerConfig,
            makeClient,
        } = await import('@mattermost/playwright-lib');

        // Login admin
        const {adminClient} = await getAdminClient();

        // Reset server config
        await adminClient.updateConfig(getOnPremServerConfig() as any);

        // Create shared team for all pages tests
        const team = await adminClient.createTeam(await createRandomTeam('pages-team', 'Pages Team'));

        // Create shared user and add to team
        const randomUser = await createRandomUser('pages-user');
        const user = await adminClient.createUser(randomUser, '', '');
        user.password = randomUser.password;
        await adminClient.addToTeam(team.id, user.id);

        // Set user preferences (skip tutorial)
        const {client: userClient} = await makeClient(user);
        const preferences = [
            {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
            {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
        ];
        await userClient.savePreferences(user.id, preferences);

        await use({team, user, adminClient});
    }, {scope: 'worker', timeout: 120000}],
});

export {expect};
