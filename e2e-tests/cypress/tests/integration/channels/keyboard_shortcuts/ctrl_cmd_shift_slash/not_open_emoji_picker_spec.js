// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @emoji @keyboard_shortcuts

import * as MESSAGES from '../../../../fixtures/messages';

import {
    doReactToLastMessageShortcut,
    pressEscapeKey,
} from './helpers';

describe('Keyboard shortcut CTRL/CMD+Shift+\\ for adding reaction to last message', () => {
    let testUser;
    let testTeam;
    let emptyChannel;

    before(() => {
        // # Enable Experimental View Archived Channels
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testTeam = team;
            emptyChannel = channel;
        });
    });

    beforeEach(() => {
        // # Login as test user and visit off-topic
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Post a message without reaction for each test
        cy.postMessage('hello');
    });

    it('MM-T4059_1 Do not open if emoji picker is already opened for other message', () => {
        // # Get post ID of the first post
        cy.getLastPostId().then((firstPostId) => {
            // # Post another message
            cy.postMessage(MESSAGES.MEDIUM);

            // # Click reaction button from the first message
            cy.clickPostReactionIcon(firstPostId);

            // # Do keyboard shortcut while emoji picker is opened
            doReactToLastMessageShortcut();

            // # Add reaction to first post
            cy.clickEmojiInEmojiPicker('smile');

            // * Verify no reaction is added to last post
            cy.getLastPostId().then((lastPostId) => {
                cy.get(`#${lastPostId}_message`).within(() => {
                    cy.findByLabelText('reactions').should('not.exist');
                    cy.findByLabelText('remove reaction smile').should('not.exist');
                });
            });
        });
    });

    it('MM-T4059_2 Do not open emoji picker if last message is not visible in view', () => {
        // # Get post ID of the first post
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).as('firstPost');
        });

        // # Make several posts, enough to enable vertical scroll
        Cypress._.times(5, () => {
            cy.uiPostMessageQuickly(MESSAGES.HUGE);
        });

        cy.postMessage(MESSAGES.SMALL);

        // # Get the post id of the last post
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).as('lastPost');
        });

        // # Scroll to top post
        cy.get('@firstPost').scrollIntoView();

        // # Do keyboard shortcut
        doReactToLastMessageShortcut();

        // * Check that emoji picker is not open
        cy.get('#emojiPicker').should('not.exist');

        // * No reaction should be present on the last message
        cy.get('@lastPost').within(() => {
            cy.findByLabelText('reactions').should('not.exist');
        });
    });

    it('MM-T4059_3 Do not open emoji picker if any modal is open', () => {
        cy.uiOpenProductMenu('About Mattermost');
        verifyEmojiPickerNotOpen();

        cy.uiOpenTeamMenu('View members');
        verifyEmojiPickerNotOpen();

        cy.uiOpenProfileModal('Profile Settings');
        verifyEmojiPickerNotOpen();

        // # Open Channel Settings Modal
        cy.uiOpenChannelMenu('Channel Settings');
        verifyEmojiPickerNotOpen();

        ['Channel Purpose', 'Channel Header'].forEach((modal) => {
            // # Open channel menu and click View Info
            cy.uiOpenChannelMenu('View Info');

            cy.findByText(modal).parent().findAllByRole('button', {name: 'Edit'}).click();

            doReactToLastMessageShortcut();

            // * Verify emoji picker is not open
            cy.get('#emojiPicker').should('not.exist');

            // # Close the modal
            pressEscapeKey();

            // # Close channel info
            cy.uiOpenChannelMenu('Close Info');
        });
    });

    it('MM-T4059_4 Do not open emoji picker if any dropdown is open', () => {
        // # Open the channel menu dropdown and do keyboard shortcut
        cy.uiOpenChannelMenu();
        doReactToLastMessageShortcut();

        // # Verify emoji picker is not open
        cy.get('#emojiPicker').should('not.exist');

        // close channel Menu
        pressEscapeKey();

        // * Open the main menu dropdown and do keyboard shortcut
        cy.uiOpenTeamMenu();
        doReactToLastMessageShortcut();

        // * Verify emoji picker is not open
        cy.get('#emojiPicker').should('not.exist');
    });

    it('MM-T4059_5 Do not open emoji picker if RHS is fully expanded for search results, recent mentions and saved posts', () => {
        // # Open the saved message
        cy.uiGetSavedPostButton().click();

        // # Expand RHS
        cy.findByLabelText('Expand Sidebar Icon').click();

        // # Do keyboard shortcut
        doReactToLastMessageShortcut();

        // * Check if emoji picker is opened
        cy.get('#emojiPicker').should('not.exist');

        // # Close the expanded RHS
        cy.findByLabelText('Collapse Sidebar Icon').click();

        // # Expand RHS
        cy.findByLabelText('Expand Sidebar Icon').click();

        // # Do keyboard shortcut
        doReactToLastMessageShortcut();

        // * Check if emoji picker is opened
        cy.get('#emojiPicker').should('not.exist');

        // # Close the expanded RHS
        cy.findByLabelText('Collapse Sidebar Icon').click();
    });

    it('MM-T4059_6 Do not open emoji picker if last post is a system message', () => {
        // # Login as admin
        cy.apiAdminLogin();

        // # Visit the new empty channel
        cy.visit(`/${testTeam.name}/channels/${emptyChannel.name}`);

        // * Check that there are no post except you joined message
        cy.findAllByTestId('postView').should('have.length', 1);

        // # Do keyboard shortcut
        doReactToLastMessageShortcut();

        // * Check that emoji picker is not opened for system joining message
        cy.get('#emojiPicker').should('not.exist');

        // # Delete the system message
        cy.getLastPostId().then((lastPostId) => {
            cy.clickPostDotMenu(lastPostId);

            // # Click delete button.
            cy.get(`#delete_post_${lastPostId}`).click();

            // * Check that confirmation dialog is open.
            cy.get('#deletePostModal').should('be.visible');

            // # Confirm deletion.
            cy.get('#deletePostModalButton').click();

            // # Do keyboard shortcut
            doReactToLastMessageShortcut('CENTER');

            // * Check that emoji picker is not opened for new channel
            cy.get('#emojiPicker').should('not.exist');
        });

        // # Post a message to channel
        cy.postMessage(MESSAGES.TINY);

        // # Archive the channel after posting a message
        cy.apiDeleteChannel(emptyChannel.id);

        // # Do keyboard shortcut
        doReactToLastMessageShortcut();

        // * Check that emoji picker is not opened
        cy.get('#emojiPicker').should('not.exist');
    });
});

function verifyEmojiPickerNotOpen() {
    // # Click emoji button
    doReactToLastMessageShortcut();

    // * Verify emoji picker is not open
    cy.get('#emojiPicker').should('not.exist');

    // # Close the modal
    pressEscapeKey();
}
