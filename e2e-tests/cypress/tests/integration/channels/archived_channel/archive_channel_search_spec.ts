// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import {getRandomId} from '../../../utils';

import {createArchivedChannel} from './helpers';

describe('archive tests while preventing viewing archived channels', () => {
    let testTeam;
    let testChannel;
    let testUser;
    const testArchivedMessage = `this is an archived post ${getRandomId()}`;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

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
                // # Remove search on archived channels
                cy.apiUpdateConfig({
                    TeamSettings: {
                        ExperimentalViewArchivedChannels: false,
                    },
                });

                cy.visit(`/${testTeam.name}/channels/off-topic`);
                cy.contains('#channelHeaderTitle', 'Off-Topic');
                cy.postMessage(getRandomId());

                // # Search for the post from step 1')
                cy.get('#searchBox').click().clear().type(`${messageText}{enter}`);

                // * Post is returned by search, since it's not archived anymore
                cy.get('#searchContainer').should('be.visible');
                cy.get('.search-item-snippet').first().contains(messageText);
            });
        });
    });

    it('MM-T1708 An archived channel can\'t be searched when "Allow users to view archived channels" is set to False in "Site Configuration > Users and Teams" in the System Console', () => {
        // # First, as system admin, ensure that System Console > Users and Teams > Allow users to view archived channels is set to `false`.
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: false,
            },
        });

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

        // # Archive dialogue message reads "This will archive the channel from the team and make its contents inaccessible for all users" (Mobile dialogue makes no mention of the data will be accessible)
        cy.get('#searchBox').click().clear().type(`${testArchivedMessage}{enter}`);

        // * Post is not returned by search
        cy.get('#searchContainer').should('be.visible');
        cy.get('.no-results__wrapper').should('be.visible');
    });

    it('MM-T1709 Archive a channel while search results are displayed in RHS', () => {
        const messageText = `search ${getRandomId()} pineapples`;

        // # Post a unique string of text in a channel
        cy.uiCreateChannel({prefix: 'archive-while-searching'}).then(() => {
            cy.postMessage(messageText);

            // # Search for the string of text from step 1
            cy.get('#searchBox').click().clear().type(`${messageText}{enter}`);

            // * Post is returned by search, since it's not archived anymore
            cy.get('#searchContainer').should('be.visible');

            // # Observe the post is displayed in RHS results
            cy.get('.search-item-snippet').first().should('contain.text', messageText);

            // # While the RHS is still open with the results, archive the channel the post was made in
            cy.uiArchiveChannel();
            cy.get('#searchContainer').should('be.visible');
            cy.get('.no-results__wrapper').should('be.visible');
        });
    });

    it('MM-T1710 archived channels are not listed on the "in:" autocomplete', () => {
        // # Archive a channel and make a mental note of the channel name
        // # Type "in:" and note the list of channels that appear
        cy.get('#searchBox').click().clear().type(`in:${testChannel.name}`);
        cy.findByTestId(testChannel.name).should('not.exist');
    });
});

