// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setAnonymousUrls} from './support';

test.describe('Anonymous URLs', () => {
    /**
     * @objective Verify that the channel URL editor is visible when creating a new channel with anonymous URLs disabled (default)
     */
    test(
        'shows channel URL editor when creating new channel with anonymous URLs disabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser} = await pw.initSetup({withDefaultProfileImage: false});

            // # Log in and go to channels
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Open new channel modal
            await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
            await channelsPage.page.locator('#createNewChannelMenuItem').click();
            await channelsPage.newChannelModal.toBeVisible();

            // # Type a display name to trigger URL generation
            await channelsPage.newChannelModal.fillDisplayName('Test Channel URL');

            // * Verify the URL editor section is visible
            await expect(channelsPage.newChannelModal.urlSection).toBeVisible();

            // # Cancel modal
            await channelsPage.newChannelModal.cancel();
        },
    );

    /**
     * @objective Verify that the team URL step is skipped when creating a team with anonymous URLs enabled and the team is created directly after entering display name
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'skips team URL step when creating team with anonymous URLs enabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            await setAnonymousUrls(adminClient, true);

            // # Log in and go to channels
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Open team menu and click Create a team
            await channelsPage.sidebarLeft.teamMenuButton.click();
            await channelsPage.teamMenu.toBeVisible();
            await channelsPage.teamMenu.clickCreateTeam();

            // # Wait for create team form
            await channelsPage.createTeamForm.toBeVisible();

            // * Verify the display name input is visible
            await expect(channelsPage.createTeamForm.teamNameInput).toBeVisible();

            // * Verify the submit button text says "Create" because team creation stays on a single step
            await expect(channelsPage.createTeamForm.teamNameSubmitButton).toContainText('Create');

            // # Enter team name and submit
            const teamName = 'Anonymous Team ' + Date.now();
            await channelsPage.createTeamForm.fillTeamName(teamName);
            await channelsPage.createTeamForm.submitDisplayName();

            // * Verify the team is created and user is redirected (no URL step shown)
            await channelsPage.toBeVisible();

            // # Verify the team has an obfuscated slug
            const teams = await adminClient.getMyTeams();
            const createdTeam = teams.find((t) => t.display_name === teamName);
            expect(createdTeam).toBeDefined();
            expect(createdTeam!.name).toMatch(/^[a-z0-9]{26}$/);
        },
    );

    /**
     * @objective Verify that the team URL step is shown when creating a team with anonymous URLs disabled (default)
     */
    test(
        'shows team URL step when creating team with anonymous URLs disabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser} = await pw.initSetup({withDefaultProfileImage: false});

            // # Log in and go to channels
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Open team menu and click Create a team
            await channelsPage.sidebarLeft.teamMenuButton.click();
            await channelsPage.teamMenu.toBeVisible();
            await channelsPage.teamMenu.clickCreateTeam();

            // # Wait for create team form
            await channelsPage.createTeamForm.toBeVisible();

            // * Verify the submit button says "Next" on the first step because the team URL step follows
            await expect(channelsPage.createTeamForm.teamNameSubmitButton).toContainText('Next');

            // # Enter team name and click Next
            await channelsPage.createTeamForm.fillTeamName('Test Team URL Step');
            await channelsPage.createTeamForm.submitDisplayName();

            // * Verify the team URL step is now visible
            await expect(channelsPage.createTeamForm.teamURLInput).toBeVisible();
            await expect(channelsPage.createTeamForm.teamURLSubmitButton).toBeVisible();
            await expect(channelsPage.createTeamForm.teamURLSubmitButton).toContainText('Finish');
        },
    );
});
