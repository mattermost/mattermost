// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @accessibility

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Verify Accessibility Support in Modals & Dialogs', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let selectedRowText;

    before(() => {
        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');

        cy.apiInitSetup({userPrefix: 'user000a'}).then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser().then(({user: newUser}) => {
                cy.apiAddUserToTeam(testTeam.id, newUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, newUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as sysadmin and visit the town-square
        cy.apiAdminLogin();
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1466 Accessibility Support in Direct Messages Dialog screen', () => {
        // * Verify the aria-label in create direct message button
        cy.uiAddDirectMessage().click();

        // * Verify the accessibility support in Direct Messages Dialog
        cy.findAllByRole('dialog', 'Direct Messages').eq(0).within(() => {
            cy.findByRole('heading', 'Direct Messages');

            // * Verify the accessibility support in search input
            cy.findByRole('textbox', {name: 'Search for people'}).
                should('have.attr', 'aria-autocomplete', 'list');

            // # Search for a text and then check up and down arrow
            cy.findByRole('textbox', {name: 'Search for people'}).
                typeWithForce('s').
                wait(TIMEOUTS.HALF_SEC).
                typeWithForce('{downarrow}{downarrow}{downarrow}{uparrow}');
            cy.get('#multiSelectList').children().eq(2).should('have.class', 'more-modal__row--selected').within(() => {
                cy.get('.more-modal__name').invoke('text').then((user) => {
                    selectedRowText = user.split(' - ')[0].replace('@', '');
                });

                // * Verify image alt is displayed
                cy.get('img.Avatar').should('have.attr', 'alt', 'user profile image');
            });

            // * Verify if the reader is able to read out the selected row
            cy.get('.filtered-user-list .sr-only').
                should('have.attr', 'aria-live', 'polite').
                and('have.attr', 'aria-atomic', 'true').
                invoke('text').then((text) => {
                    expect(text).equal(selectedRowText);
                });

            // # Search for an invalid text
            const additionalSearchTerm = 'somethingwhichdoesnotexist';
            cy.findByRole('textbox', {name: 'Search for people'}).clear().
                typeWithForce(additionalSearchTerm).
                wait(TIMEOUTS.HALF_SEC);

            // * Check if reader can read no results
            cy.get('.multi-select__wrapper').should('have.attr', 'aria-live', 'polite').and('have.text', `No results found matching ${additionalSearchTerm}`);
        });
    });

    it('MM-T1467 Accessibility Support in More Channels Dialog screen', () => {
        function getChannelAriaLabel(channel) {
            return channel.display_name.toLowerCase() + ', ' + channel.purpose.toLowerCase();
        }

        // # Create atleast 2 channels
        let otherChannel;
        cy.apiCreateChannel(testTeam.id, 'z_accessibility', 'Z Accessibility', 'O', 'other purpose').then(({channel}) => {
            otherChannel = channel;
        });
        cy.apiCreateChannel(testTeam.id, 'accessibility', 'Accessibility', 'O', 'some purpose').then(({channel}) => {
            cy.apiLogin(testUser).then(() => {
                cy.reload();

                // * Verify the aria-label in more public channels button
                cy.uiBrowseOrCreateChannel('Browse channels').click();

                // * Verify the accessibility support in More Channels Dialog
                cy.findByRole('dialog', {name: 'Browse Channels'}).within(() => {
                    cy.findByRole('heading', {name: 'Browse Channels'});

                    // * Verify the accessibility support in search input
                    cy.findByPlaceholderText('Search channels');

                    cy.get('#moreChannelsList').should('be.visible').then((el) => {
                        return el[0].children.length === 2;
                    });

                    // # Hide already joined channels
                    cy.findByText('Hide Joined').click();

                    // # Focus on the Create Channel button and TAB four time
                    cy.get('#createNewChannelButton').focus().tab().tab().tab().tab();

                    // * Verify channel name is highlighted and reader reads the channel name and channel description
                    cy.get('#moreChannelsList').within(() => {
                        const selectedChannel = getChannelAriaLabel(channel);
                        cy.findByLabelText(selectedChannel).should('be.visible').should('be.focused');
                    });

                    // * Press Tab again and verify if focus changes to next row
                    cy.focused().tab();
                    cy.findByLabelText(getChannelAriaLabel(otherChannel)).should('be.focused');
                });
            });
        });
    });

    it('MM-T1468 Accessibility Support in Add people to Channel Dialog screen', () => {
        // # Add atleast 5 users
        for (let i = 0; i < 5; i++) {
            cy.apiCreateUser().then(({user}) => { // eslint-disable-line
                cy.apiAddUserToTeam(testTeam.id, user.id);
            });
        }

        // # Visit the test channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open Add Members Dialog
        cy.get('#channelHeaderDropdownIcon').click();
        cy.findByText('Add Members').click();

        // * Verify the accessibility support in Add people Dialog
        cy.findAllByRole('dialog').eq(0).within(() => {
            const modalName = `Add people to ${testChannel.display_name}`;
            cy.findByRole('heading', {name: modalName});

            // * Verify the accessibility support in search input
            cy.findByRole('textbox', {name: 'Search for people'}).
                should('have.attr', 'aria-autocomplete', 'list');

            // # Search for a text and then check up and down arrow
            cy.findByRole('textbox', {name: 'Search for people'}).
                typeWithForce('u').
                wait(TIMEOUTS.HALF_SEC).
                typeWithForce('{downarrow}{downarrow}{downarrow}{uparrow}');
            cy.get('#multiSelectList').
                children().eq(1).
                should('have.class', 'more-modal__row--selected').
                within(() => {
                    cy.get('.more-modal__name').invoke('text').then((user) => {
                        selectedRowText = user.split(' - ')[0].replace('@', '');
                    });

                    // * Verify image alt is displayed
                    cy.get('img.Avatar').should('have.attr', 'alt', 'user profile image');
                });

            // * Verify if the reader is able to read out the selected row
            cy.get('.filtered-user-list .sr-only').
                should('have.attr', 'aria-live', 'polite').
                and('have.attr', 'aria-atomic', 'true').
                invoke('text').then((text) => {
                    expect(text).equal(selectedRowText);
                });

            // # Search for an invalid text and check if reader can read no results
            cy.findByRole('textbox', {name: 'Search for people'}).
                typeWithForce('somethingwhichdoesnotexist').
                wait(TIMEOUTS.HALF_SEC);

            // * Check if reader can read no results
            cy.get('.custom-no-options-message').
                should('be.visible').
                and('contain', 'No matches found - Invite them to the team');
        });
    });

    it('MM-T1515 Verify Accessibility Support in Invite People Flow', () => {
        // # Open Invite People
        cy.uiGetLHSHeader().click();
        cy.get('#invitePeople').should('be.visible').click();

        // * Verify accessibility support in Invite People Dialog
        cy.get('.InvitationModal').should('have.attr', 'aria-modal', 'true').and('have.attr', 'aria-labelledby', 'invitation_modal_title').and('have.attr', 'role', 'dialog');
        cy.get('#invitation_modal_title').should('be.visible').and('contain.text', 'Invite people to');

        // # Press tab
        cy.get('button.icon-close').focus().tab({shift: true}).tab();

        // * Verify tab focuses on close button
        cy.get('button.icon-close').should('have.attr', 'aria-label', 'Close').and('be.focused');
    });
});

