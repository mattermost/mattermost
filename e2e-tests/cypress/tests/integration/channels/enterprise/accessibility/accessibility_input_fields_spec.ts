// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @accessibility

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Verify Accessibility Support in different input fields', () => {
    let testTeam: Team;
    let testChannel: Channel;

    before(() => {
        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });
    });

    beforeEach(() => {
        cy.apiCreateChannel(testTeam.id, 'accessibility', 'accessibility').then(({channel}) => {
            testChannel = channel;
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T1456 Verify Accessibility Support in Input fields in Invite People Flow', () => {
        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite people');

        // # Click invite members if needed
        cy.get('.InviteAs').findByTestId('inviteMembersLink').click();

        cy.findByTestId('InviteView__copyInviteLink').then((el) => {
            const copyInviteLinkAriaLabel = el.attr('aria-label');
            expect(copyInviteLinkAriaLabel).to.match(/^team invite link/i);
        });

        // * Verify Accessibility Support in Add or Invite People input field
        cy.get('.users-emails-input__control').should('be.visible').within(() => {
            cy.get('input').should('have.attr', 'aria-label', 'Add or Invite People').and('have.attr', 'aria-autocomplete', 'list');
            cy.get('.users-emails-input__placeholder').should('have.text', 'Enter a name or email address');
        });

        // # Click on Invite Guests link
        cy.findByTestId('inviteGuestLink').should('be.visible').click();

        // * Verify Accessibility Support in Invite People input field
        cy.get('.users-emails-input__control').should('be.visible').within(() => {
            cy.get('input').should('have.attr', 'aria-label', 'Add or Invite People').and('have.attr', 'aria-autocomplete', 'list');
            cy.get('.users-emails-input__placeholder').should('have.text', 'Enter a name or email address');
        });

        // * Verify Accessibility Support in Search and Add Channels input field
        cy.get('.channels-input__control').should('be.visible').within(() => {
            cy.get('input').should('have.attr', 'aria-label', 'Search and Add Channels').and('have.attr', 'aria-autocomplete', 'list');
            cy.get('.channels-input__placeholder').should('have.text', `e.g. ${testChannel.display_name}`);
        });
    });

    it('MM-T1457 Verify Accessibility Support in Search Autocomplete', () => {
        // # Adding at least five other users in the channel
        for (let i = 0; i < 5; i++) {
            cy.apiCreateUser().then(({user}) => {
                cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, user.id);
                });
            });
        }

        cy.uiGetSearchContainer().click();

        // * Verify Accessibility support in search input
        cy.uiGetSearchBox().should('have.attr', 'aria-describedby', 'searchbar-help-popup').and('have.attr', 'aria-label', 'Search messages');
        cy.uiGetSearchBox().focus();
        cy.get('#searchHints').should('be.visible');

        // # Ensure User list is cached once in UI
        cy.uiGetSearchBox().type('from:').wait(TIMEOUTS.ONE_SEC);

        // # Trigger the user autocomplete again
        cy.uiGetSearchBox().clear().type('from:').wait(TIMEOUTS.ONE_SEC).type('{downarrow}{downarrow}');

        // * Verify Accessibility Support in search autocomplete
        verifySearchAutocomplete(2);

        // # Press Down arrow twice and verify if focus changes
        cy.focused().type('{downarrow}{downarrow}');
        verifySearchAutocomplete(4);

        // # Press Up arrow and verify if focus changes
        cy.focused().type('{uparrow}');
        verifySearchAutocomplete(3);

        // # Type the in: filter and ensure channel list is cached once
        cy.uiGetSearchBox().clear().type('in:').wait(TIMEOUTS.ONE_SEC);

        // # Trigger the channel autocomplete again
        cy.uiGetSearchBox().clear().type('in:').wait(TIMEOUTS.ONE_SEC).type('{downarrow}{downarrow}');

        // * Verify Accessibility Support in search autocomplete
        verifySearchAutocomplete(2);

        // # Press Up arrow and verify if focus changes
        cy.focused().type('{uparrow}{uparrow}');
        verifySearchAutocomplete(0);
    });

    it('MM-T1455 Verify Accessibility Support in Message Autocomplete', () => {
        // # Adding at least one other user in the channel
        cy.apiCreateUser().then(({user}) => {
            cy.apiAddUserToTeam(testTeam.id, user.id).then(() => {
                cy.apiAddUserToChannel(testChannel.id, user.id).then(() => {
                    // * Verify Accessibility support in post input field
                    cy.uiGetPostTextBox().should('have.attr', 'placeholder', `Write to ${testChannel.display_name}`).clear().focus();

                    // # Ensure User list is cached once in UI
                    cy.uiGetPostTextBox().type('@').wait(TIMEOUTS.ONE_SEC);

                    // # Select the first user in the list
                    cy.get('#suggestionList').find('.suggestion-list__item').eq(0).within((el) => {
                        cy.get('.suggestion-list__main').invoke('text').then((text) => {
                            cy.wrap(el).parents('body').find('#post_textbox').clear().type(text);
                        });
                    });

                    // # Trigger the user autocomplete again
                    cy.uiGetPostTextBox().clear().type('@').wait(TIMEOUTS.ONE_SEC).type('{uparrow}{uparrow}{downarrow}');

                    // * Verify Accessibility Support in message autocomplete
                    verifyMessageAutocomplete(1);

                    // # Press Up arrow and verify if focus changes
                    cy.focused().type('{downarrow}{uparrow}{uparrow}');

                    // * Verify Accessibility Support in message autocomplete
                    verifyMessageAutocomplete(0);

                    // # Trigger the channel autocomplete filter and ensure channel list is cached once
                    cy.uiGetPostTextBox().clear().type('~').wait(TIMEOUTS.ONE_SEC);

                    // # Trigger the channel autocomplete again
                    cy.uiGetPostTextBox().clear().type('~').wait(TIMEOUTS.FIVE_SEC).type('{downarrow}{downarrow}');

                    // * Verify Accessibility Support in message autocomplete
                    verifyMessageAutocomplete(2);

                    // # Press Up arrow and verify if focus changes
                    cy.focused().type('{downarrow}{uparrow}{uparrow}');

                    // * Verify Accessibility Support in message autocomplete
                    verifyMessageAutocomplete(1);
                });
            });
        });
    });

    it('MM-T1458 Verify Accessibility Support in Main Post Input', () => {
        cy.get('#advancedTextEditorCell').within(() => {
            // * Verify Accessibility Support in Main Post input
            cy.uiGetPostTextBox().should('have.attr', 'placeholder', `Write to ${testChannel.display_name}`).and('have.attr', 'role', 'textbox').clear().focus().type('test');

            // # Set a11y focus on the textbox
            cy.get('#FormattingControl_bold').focus().tab({shift: true});

            // * Verify if the focus is on the preview button
            cy.get('#PreviewInputTextButton').should('be.focused').and('have.attr', 'aria-label', 'preview').tab();

            // * Verify if the focus is on the bold button
            cy.get('#FormattingControl_bold').should('be.focused').and('have.attr', 'aria-label', 'bold').tab();

            // * Verify if the focus is on the italic button
            cy.get('#FormattingControl_italic').should('be.focused').and('have.attr', 'aria-label', 'italic').tab();

            // * Verify if the focus is on the strike through button
            cy.get('#FormattingControl_strike').should('be.focused').and('have.attr', 'aria-label', 'strike through').tab();

            // * Verify if the focus is on the heading button
            cy.get('#FormattingControl_heading').should('be.focused').and('have.attr', 'aria-label', 'heading').tab();

            // * Verify if the focus is on the link button
            cy.get('#FormattingControl_link').should('be.focused').and('have.attr', 'aria-label', 'link').tab();

            // * Verify if the focus is on the code block button
            cy.get('#FormattingControl_code').should('be.focused').and('have.attr', 'aria-label', 'code').tab();

            // * Verify if the focus is on the preview button
            cy.get('#FormattingControl_quote').should('be.focused').and('have.attr', 'aria-label', 'quote').tab();

            // * Verify if the focus is on the bulleted list button
            cy.get('#FormattingControl_ul').should('be.focused').and('have.attr', 'aria-label', 'bulleted list').tab();

            // * Verify if the focus is on the numbered list button
            cy.get('#FormattingControl_ol').should('be.focused').and('have.attr', 'aria-label', 'numbered list').tab().tab();

            // * Verify if the focus is on the formatting options button
            cy.get('#toggleFormattingBarButton').should('be.focused').and('have.attr', 'aria-label', 'formatting').tab();

            // * Verify if the focus is on the attachment icon
            cy.get('#fileUploadButton').should('be.focused').and('have.attr', 'aria-label', 'attachment').tab();

            // * Verify if the focus is on the emoji picker
            cy.get('#emojiPickerButton').should('be.focused').and('have.attr', 'aria-label', 'select an emoji').tab();
        });

        // * Verify if the focus is on the help link
        cy.findByTestId('SendMessageButton').should('be.focused');
    });

    it('MM-T1490 Verify Accessibility Support in RHS Input', () => {
        // # Wait till page is loaded
        cy.uiGetPostTextBox().clear();

        // # Post a message and open RHS
        const message = `hello${Date.now()}`;
        cy.postMessage(message);
        cy.getLastPostId().then((postId) => {
            // # Mouseover the post and click post comment icon.
            cy.clickPostCommentIcon(postId);
        });

        cy.get('#rhsContainer').within(() => {
            // * Verify Accessibility Support in RHS input
            cy.uiGetReplyTextBox().should('have.attr', 'placeholder', 'Reply to this thread...').and('have.attr', 'role', 'textbox').focus().type('test').tab();

            // * Verify if the focus is on the preview button
            cy.get('#PreviewInputTextButton').should('be.focused').and('have.attr', 'aria-label', 'preview').tab();

            // * Verify if the focus is on the bold button
            cy.get('#FormattingControl_bold').should('be.focused').and('have.attr', 'aria-label', 'bold').tab();

            // * Verify if the focus is on the italic button
            cy.get('#FormattingControl_italic').should('be.focused').and('have.attr', 'aria-label', 'italic').tab();

            // * Verify if the focus is on the strike through button
            cy.get('#FormattingControl_strike').should('be.focused').and('have.attr', 'aria-label', 'strike through').tab();

            // * Verify if the focus is on the hidden controls button
            cy.get('#HiddenControlsButtonRHS_COMMENT').should('be.focused').and('have.attr', 'aria-label', 'show hidden formatting options').click().tab();

            // * Verify if the focus is on the hidden heading button
            cy.get('#FormattingControl_heading').should('be.focused').and('have.attr', 'aria-label', 'heading').tab();

            // * Verify if the focus is on the hidden link button
            cy.get('#FormattingControl_link').should('be.focused').and('have.attr', 'aria-label', 'link').tab();

            // * Verify if the focus is on the hidden code button
            cy.get('#FormattingControl_code').should('be.focused').and('have.attr', 'aria-label', 'code').tab();

            // * Verify if the focus is on the hidden quote button
            cy.get('#FormattingControl_quote').should('be.focused').and('have.attr', 'aria-label', 'quote').tab();

            // * Verify if the focus is on the hidden bulleted list button
            cy.get('#FormattingControl_ul').should('be.focused').and('have.attr', 'aria-label', 'bulleted list').tab();

            // * Verify if the focus is on the hidden numbered list button
            cy.get('#FormattingControl_ol').should('be.focused').and('have.attr', 'aria-label', 'numbered list').tab();

            // * Verify if the focus is on the formatting options button
            cy.get('#toggleFormattingBarButton').should('be.focused').and('have.attr', 'aria-label', 'formatting').tab();

            // * Verify if the focus is on the attachment icon
            cy.get('#fileUploadButton').should('be.focused').and('have.attr', 'aria-label', 'attachment').tab();

            // * Verify if the focus is on the emoji picker
            cy.get('#emojiPickerButton').should('be.focused').and('have.attr', 'aria-label', 'select an emoji').tab();

            // * Verify if the focus is on the Reply button
            cy.findByTestId('SendMessageButton').should('be.focused');
        });
    });
});

function verifySearchAutocomplete(index) {
    cy.get('#searchBox').find('.suggestion-list__item').eq(index).should('be.visible').
        and('have.class', 'suggestion--selected').
        invoke('attr', 'id').then((suggestionId) => {
            cy.get('#searchBox').find('[role="searchbox"]').should('have.attr', 'aria-activedescendant', suggestionId);
        });
}

function verifyMessageAutocomplete(index) {
    cy.get('#suggestionList').find('.suggestion-list__item').eq(index).should('be.visible').and('have.class', 'suggestion--selected');
    cy.get('#suggestionList').find('.suggestion-list__item').eq(index).invoke('attr', 'id').then((selectedId) => {
        cy.wrap(selectedId).should('not.equal', '');

        cy.uiGetPostTextBox().should('have.attr', 'aria-activedescendant', selectedId);
    });
}
