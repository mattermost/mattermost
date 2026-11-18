// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, duration} from '@mattermost/playwright-lib';

/** Opens Invite People from the team menu. */
async function openInvitePeople(app: App) {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    const teamMenu = app.lhs.teamMenu;
    await expect(teamMenu).toBeVisible();
    await teamMenu.invitePeopleMenuItem.click();
    const modal = app.invitationModal;
    await expect(modal).toBeVisible();
    return modal;
}

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
        const {team, adminUser, townSquare} = await pw.initSetup();

        // # Log in as admin
        const {app} = await pw.testBrowser.login(adminUser);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: townSquare});
        // (the first load of a new team's channel can be slow on this server)
        await expect(app.center.postCreate.message.container).toBeVisible({timeout: duration.one_min});

        // # Open team menu and click Invite people
        const modal = await openInvitePeople(app);

        // * Verify the Invite People modal has proper accessibility attributes
        const inviteModal = modal;
        await expect(inviteModal).toHaveAttribute('aria-modal', 'true');
        await expect(inviteModal).toHaveAttribute('aria-labelledby', 'invitation_modal_title');
        await expect(inviteModal).toHaveAttribute('role', 'dialog');

        // * Verify the modal title is visible and contains correct text
        const modalTitle = modal.invite.titleText;
        await expect(modalTitle).toBeVisible();
        await expect(modalTitle).toContainText('Invite people to');

        // # Get the close button and verify accessibility
        const closeButton = modal.invite.closeButton;
        await expect(closeButton).toBeVisible();
        await expect(closeButton).toHaveAccessibleName('Close');

        // # Focus on close button and verify tab navigation works
        await closeButton.focus();
        await closeButton.press('Shift+Tab', 'Tab');

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
        const {team, user, adminClient, townSquare} = await pw.initSetup();

        // # Turn off email invitations, which change the invite input's placeholder from
        // # "Add members" to "Enter a name or email address" in the snapshot below
        await adminClient.patchConfig({ServiceSettings: {EnableEmailInvitations: false}});

        // # Log in as user
        const {app, page} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open team menu and click Invite people
        const modal = await openInvitePeople(app);

        // * Verify the Invite People modal is visible
        const inviteModal = modal;

        // * Verify aria snapshot of Invite People dialog (key structural elements only)
        await expect(inviteModal).toMatchAriaSnapshot(`
            - dialog:
              - document:
                - heading [level=1]
                - button
                - text: "To:"
                - log
                - text: Add members
                - combobox "Invite People"
                - listbox
                - button
                - button "Invite" [disabled]
        `);

        // * Analyze the Invite People dialog for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include('[role="dialog"]')
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
