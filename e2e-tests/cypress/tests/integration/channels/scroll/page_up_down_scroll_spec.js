// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @scroll

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Scroll', () => {
    let testTeam;
    let testChannel;
    let otherUser;

    beforeEach(() => {
        // # Create new team and new user and visit Town Square channel
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });

            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Post at least 20 messages in a channel
            Cypress._.times(20, (index) => cy.postMessage(index));
        });
    });

    it('should focus on postListScrollContainer when PAGE_UP is pressed', () => {
        // # Focus the advanced text editor
        cy.get('#post_textbox').focus();

        // # Press PAGE_UP key
        cy.get('body').type('{pageup}');

        // * Verify if the focus is transferred to postListScrollContainer
        cy.get('#postListScrollContainer').should('be.focused');
    });

    it('should focus on postListScrollContainer when PAGE_DOWN is pressed', () => {
        // # Focus the advanced text editor
        cy.get('#post_textbox').focus();

        // # Press PAGE_DOWN key
        cy.get('body').type('{pagedown}');

        // * Verify if the focus is transferred to postListScrollContainer
        cy.get('#postListScrollContainer').should('be.focused');
    });

    it('should scroll up when PAGE_UP is pressed', () => {
        // # Focus the advanced text editor
        cy.get('#post_textbox').focus();

        // # Get initial scroll position
        cy.get('#postListScrollContainer').then(($el) => {
            const initialScrollTop = $el.scrollTop();

            // # Press PAGE_UP key
            cy.get('body').type('{pageup}');

            // * Verify if the scroll position has changed
            cy.get('#postListScrollContainer').should(($e) => {
                expect($e.scrollTop()).to.be.lessThan(initialScrollTop);
            });
        });
    });

    it('should scroll down when PAGE_DOWN is pressed', () => {
        // # Focus the advanced text editor
        cy.get('#post_textbox').focus();

        // # Scroll to top
        cy.get('#postListScrollContainer').should('be.visible').scrollTo('top', {duration: TIMEOUTS.ONE_SEC}).wait(TIMEOUTS.ONE_SEC);

        // # Get initial scroll position
        cy.get('#postListScrollContainer').then(($el) => {
            const initialScrollTop = $el.scrollTop();

            // # Press PAGE_DOWN key
            cy.get('body').type('{pagedown}');

            // * Verify if the scroll position has changed
            cy.get('#postListScrollContainer').should(($e) => {
                expect($e.scrollTop()).to.be.greaterThan(initialScrollTop);
            });
        });
    });
});

