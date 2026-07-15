// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify accessibility support in Invite People Flow
 */
test(
    'MM-T1515 Verify Accessibility Support in Invite People Flow',
    {tag: ['@accessibility', '@invite_people']},
    async ({pw}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, adminUser} = await pw.initSetup();

        // # Log in as admin
        const {page, channelsPage} = await pw.testBrowser.login(adminUser);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open team menu and click Invite people
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();

        const invitePeopleMenuItem = page.locator("#sidebarTeamMenu li:has-text('Invite people')");
        await invitePeopleMenuItem.click();

        // * Verify the Invite People modal has proper accessibility attributes
        const inviteModal = page.getByTestId('invitationModal');
        await expect(inviteModal).toBeVisible();
        await expect(inviteModal).toHaveAttribute('aria-modal', 'true');
        await expect(inviteModal).toHaveAttribute('aria-labelledby', 'invitation_modal_title');
        await expect(inviteModal).toHaveAttribute('role', 'dialog');

        // * Verify the modal title is visible and contains correct text
        const modalTitle = page.locator('#invitation_modal_title');
        await expect(modalTitle).toBeVisible();
        await expect(modalTitle).toContainText('Invite people to');

        // # Get the close button and verify accessibility
        const closeButton = inviteModal.locator('button.icon-close');
        await expect(closeButton).toHaveAttribute('aria-label', 'Close');

        // # Focus on close button and verify tab navigation works
        await closeButton.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');

        // * Verify focus returns to close button
        await expect(closeButton).toBeFocused();
    },
);

/**
 * @objective Verify Invite People dialog passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Invite People dialog',
    {tag: ['@accessibility', '@invite_people', '@snapshots']},
    async ({pw, axe}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, user, adminClient} = await pw.initSetup();
        const inviteCandidate = await adminClient.createUser(await pw.random.user(), '', '');

        // # Log in as user
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open team menu and click Invite people
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();

        const invitePeopleMenuItem = page.locator("#sidebarTeamMenu li:has-text('Invite people')");
        await invitePeopleMenuItem.click();

        // * Verify the Invite People modal is visible
        const inviteModal = page.getByTestId('invitationModal');
        await expect(inviteModal).toBeVisible();
        const inviteInput = inviteModal.getByRole('combobox', {name: 'Invite People'});
        await inviteInput.pressSequentially(inviteCandidate.username);
        const listbox = page.getByRole('listbox');
        await expect(listbox).toBeVisible();
        await expect(listbox.getByRole('option', {name: new RegExp(inviteCandidate.username)})).toBeVisible();

        // * Verify aria snapshot of Invite People dialog (key structural elements only).
        await expect(inviteModal).toMatchAriaSnapshot(`
            - dialog /Invite people to/:
              - document:
                - heading /Invite people to/ [level=1]
                - button "Close"
                - text: "To:"
                - log
                - text: Add members
                - combobox "Invite People" [expanded]
                - button /team invite link/
                - button "Invite" [disabled]
        `);

        // * Analyze the Invite People dialog for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include('[data-testid="invitationModal"]')
            .include('.users-emails-input__menu-portal')
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
