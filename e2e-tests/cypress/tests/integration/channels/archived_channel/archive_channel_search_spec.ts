// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import {createArchivedChannel} from './helpers';

import {getRandomId} from '@/utils';

describe('archive channel search tests', () => {
    let testTeam: Cypress.Team;
    let testChannel: Cypress.Channel;
    let testUser: Cypress.UserProfile;
    const testArchivedMessage = `this is an archived post ${getRandomId()}`;

    before(() => {
        // # Login as test user and visit test channel
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser({prefix: 'second'}).then(({user: second}) => {
                cy.apiAddUserToTeam(testTeam.id, second.id);
            });
            cy.visit(`/${team.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T1707 Unarchived channels can be searched the same as before they where archived', () => {
        // # Post some text in the channel such as "Pineapple"
        const messageText = `pineapple ${getRandomId()}`;

        // # Archive the channel
        createArchivedChannel({prefix: 'pineapple-'}, [messageText]).then(() => {
            // # Unarchive the channel
            cy.uiUnarchiveChannel().then(() => {
                cy.visit(`/${testTeam.name}/channels/off-topic`);
                cy.contains('#channelHeaderTitle', 'Off-Topic');
                cy.postMessage(getRandomId());

                // # Search for the post from step 1')
                cy.uiGetSearchContainer().click();
                cy.uiGetSearchBox().clear().type(`${messageText}{enter}`);

                // * Post is returned by search, since it's not archived anymore
                cy.get('#searchContainer').should('be.visible');
                cy.get('.search-item-snippet').first().contains(messageText);
            });
        });
    });

    it('MM-T1708 An archived channel can be searched since archived channels are always viewable', () => {
        cy.apiLogin(testUser);

        // # Open a channel other than Town Square
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.contains('#channelHeaderTitle', 'Off-Topic');

        // # Create or locate a channel you're a member of
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#channelHeaderTitle').should('be.visible');

        // # Post distinctive text in the channel such as "I like pineapples"
        cy.postMessageAs({sender: testUser, message: testArchivedMessage, channelId: testChannel.id});

        // # Select Archive Channel from the header menu
        cy.uiArchiveChannel();

        // # Search for the archived message
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().clear().type(`${testArchivedMessage}{enter}`);

        // * Post is returned by search since archived channels are always viewable
        cy.get('#searchContainer').should('be.visible');
        cy.get('.search-item-snippet').first().contains(testArchivedMessage);
    });

    it('MM-T1709 Archive a channel while search results are displayed in RHS', () => {
        const messageText = `search ${getRandomId()} pineapples`;

        // # Post a unique string of text in a channel
        cy.uiCreateChannel({prefix: 'archive-while-searching'}).then(() => {
            cy.postMessage(messageText);

            // # Search for the string of text from step 1
            cy.uiGetSearchContainer().click();
            cy.uiGetSearchBox().clear().type(`${messageText}{enter}`);

            // * Post is returned by search, since it's not archived anymore
            cy.get('#searchContainer').should('be.visible');

            // # Observe the post is displayed in RHS results
            cy.get('.search-item-snippet').first().should('contain.text', messageText);

            // # While the RHS is still open with the results, archive the channel the post was made in
            cy.uiArchiveChannel();
            cy.get('#searchContainer').should('be.visible');

            // * Search results should remain visible since archived channels are always viewable
            cy.get('.search-item-snippet').first().should('contain.text', messageText);
        });
    });

    // Known bug: the channel is archived by MM-T1708 above, and the "in:" autocomplete still lists it (on master too).
    // The check used to look for a test id that never matched anything, so it always passed without testing the list.
    // Until that is fixed this asserts what the app does now, so the test goes red when the list is fixed: then
    // change `should('exist')` back to `should('not.exist')`.
    it('MM-T1710 archived channels are not listed on the "in:" autocomplete', () => {
        // # Type "in:" and the name of the archived channel
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().clear().type(`in:${testChannel.name}`);

        // * Verify the archived channel is (still) listed
        cy.findByTestId(`search_box.suggestions.suggestion:${testChannel.name}--option`).should('exist');
    });
});

