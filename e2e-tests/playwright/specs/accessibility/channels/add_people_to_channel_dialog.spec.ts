// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, duration} from '@mattermost/playwright-lib';

import {highlightedUser} from './multiselect_support';

/** Opens the channel's Members panel, then its Add people dialog. */
async function openAddPeople(app: App) {
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    const menu = app.channelHeader.menu;
    await menu.membersMenuItem.click();
    await expect(app.rhs.channelMembers).toBeVisible();
    await expect(app.rhs.channelMembers.addButton).toBeEnabled();
    const channelInviteModal = await app.rhs.channelMembers.addButton.clickTo(app.channelInviteModal);
    await expect(channelInviteModal).toBeVisible();
    return channelInviteModal;
}

/**
 * @objective Verify accessibility support in Add people to Channel Dialog screen
 */
test(
    'MM-T1468 Accessibility Support in Add people to Channel Dialog screen',
    {tag: ['@accessibility', '@add_people_channel']},
    async ({pw}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Turn off email invitations, which replace the no-results message asserted below with an
        // # invite-to-team prompt
        await adminClient.patchConfig({ServiceSettings: {EnableEmailInvitations: false}});

        // # Create a channel in the team
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                displayName: 'Test Channel',
                name: 'test-channel',
            }),
        );

        // # Create additional users and add to team
        for (let i = 0; i < 5; i++) {
            const newUser = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.addToTeam(team.id, newUser.id);
        }

        // # Log in as admin
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit the test channel
        await app.channelsPage.goto({team, channel});
        // (the first load of a new team's channel can be slow on this server)
        await expect(app.center.postCreate.message.container).toBeVisible({timeout: duration.one_min});

        // # Open channel menu and click Members, then click the Add people button
        // * Verify the Add people dialog is visible
        const dialog = await openAddPeople(app);

        // * Verify the heading with channel name
        const modalName = `Add people to ${channel.display_name}`;
        await expect(dialog.headingText).toHaveText(modalName);
        await expect(dialog.headingText.locator).toMatchAriaSnapshot(`- heading "${modalName}" [level=1]`);

        // * Verify the search input has proper accessibility attributes
        const people = dialog.users;
        const searchInput = people.searchCombobox;
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAccessibleName('Search for people or groups');
        await expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

        // # Search for a text and navigate with arrow keys
        await searchInput.fill('u');
        await expect(searchInput).toHaveValue('u');
        await expect.poll(async () => (await people.results.userList.keys()).length).toBeGreaterThan(0);

        // # Navigate down through the list
        await searchInput.press('ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp');

        // * Verify the selected row has the correct class
        await expect(async () => {
            await highlightedUser(people.results);
        }).toPass();
        const selectedRow = await highlightedUser(people.results);
        await expect(selectedRow).toBeVisible();

        // * Verify image alt is displayed for user profile
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the avatar's accessible name (its alt text) is the thing under test
        const avatar = selectedRow.locator.getByRole('img', {name: 'user profile image'});
        await expect(avatar).toHaveAttribute('alt', 'user profile image');

        // * Verify screen reader live region exists and has proper attributes
        const srOnlyRegion = people.results.selectionText;
        await expect(srOnlyRegion).toHaveAttribute('aria-live', 'polite');
        await expect(srOnlyRegion).toHaveAttribute('aria-atomic', 'true');

        // # Search for an invalid text
        await searchInput.fill('somethingwhichdoesnotexist');

        // * Check if the no results message is displayed with proper accessibility
        const noResultsWrapper = people.results.liveRegion;
        await expect(people.results.noResultsText).toBeVisible();
        await expect(people.results.noResultsText).toContainText(/No matches found|No results found matching/i);
        await expect(noResultsWrapper).toHaveAttribute('aria-live', 'polite');
    },
);

/**
 * @objective Verify Add people to Channel dialog passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Add people to Channel dialog',
    {tag: ['@accessibility', '@add_people_channel', '@snapshots']},
    async ({pw, axe}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, adminUser, adminClient} = await pw.initSetup();

        // # Create a channel in the team
        const channel = await adminClient.createChannel(
            pw.random.channel({
                teamId: team.id,
                displayName: 'Test Channel',
                name: 'test-channel',
            }),
        );

        // # Create additional users and add to team
        for (let i = 0; i < 3; i++) {
            const newUser = await adminClient.createUser(await pw.random.user(), '', '');
            await adminClient.addToTeam(team.id, newUser.id);
        }

        // # Log in as admin
        const {app, page} = await pw.testBrowser.login(adminUser);

        // # Visit the test channel
        await app.channelsPage.goto({team, channel});
        // (the first load of a new team's channel can be slow on this server)
        await expect(app.center.postCreate.message.container).toBeVisible({timeout: duration.one_min});

        // # Open channel menu and click Members, then click the Add people button
        // * Verify the Add people dialog is visible
        const dialog = await openAddPeople(app);

        // * Verify aria snapshot of Add people to Channel dialog
        await expect(dialog).toMatchAriaSnapshot(`
            - dialog "Add people to Test Channel":
              - document:
                - heading "Add people to Test Channel" [level=1]
                - button "Close"
                - log
                - text: Search for people or groups
                - combobox "Search for people or groups"
                - button "Cancel"
                - button "Add"
        `);

        // * Analyze the Add people dialog for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include('[role="dialog"]')
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
