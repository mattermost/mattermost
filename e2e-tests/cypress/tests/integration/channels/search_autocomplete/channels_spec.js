// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @autocomplete

import {
    createPrivateChannel,
    searchForChannel,
} from '../enterprise/elasticsearch_autocomplete/helpers';

import {getAdminAccount} from '../../../support/env';

describe('Autocomplete without Elasticsearch - Channel', () => {
    const admin = getAdminAccount();
    let testTeam;
    let testUser;
    let offTopicUrl;

    before(() => {
        cy.apiGetClientLicense().then(({isCloudLicensed}) => {
            if (!isCloudLicensed) {
                cy.shouldHaveElasticsearchDisabled();
            }
        });

        // # Login as test user and go to off-topic
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            testUser = out.user;
            testTeam = out.team;
            offTopicUrl = out.offTopicUrl;

            cy.visit(offTopicUrl);
        });
    });

    afterEach(() => {
        cy.reload();
    });

    it("private channel I don't belong to does not appear", () => {
        // # Create private channel, do not add new user to it (sets @privateChannel alias)
        createPrivateChannel(testTeam.id).then((channel) => {
            // # Go to off-topic channel to partially reload the page
            cy.uiGetLhsSection('CHANNELS').findAllByText('Off-Topic').click();

            // # Search for the private channel
            searchForChannel(channel.name);

            // * And it should not appear
            cy.findByTestId(channel.name).
                should('not.exist');
        });
    });

    it('private channel I do belong to appears', () => {
        // # Go to off-topic channel to partially reload the page
        cy.uiGetLhsSection('CHANNELS').findAllByText('Off-Topic').click();

        // # Create private channel and add new user to it (sets @privateChannel alias)
        createPrivateChannel(testTeam.id, testUser).then((channel) => {
            // # Search for the private channel
            searchForChannel(channel.name);

            // * Suggestion list should appear
            cy.get('#suggestionList').should('be.visible');

            // * Channel should appear in the list
            cy.findByTestId(channel.name).
                should('be.visible');
        });
    });

    it('channel outside of team does not appear', () => {
        const teamName = 'elastic-private-' + Date.now();
        const baseUrl = Cypress.config('baseUrl');

        // # As admin, create a new team that the new user is not a member of
        cy.task('externalRequest', {
            user: admin,
            path: 'teams',
            baseUrl,
            method: 'post',
            data: {
                name: teamName,
                display_name: teamName,
                type: 'O',
            },
        }).then((teamResponse) => {
            expect(teamResponse.status).to.equal(201);

            // # Create a private channel where the new user is not a member of
            createPrivateChannel(teamResponse.data.id).then((channel) => {
                // # Go to off-topic channel to partially reload the page
                cy.uiGetLhsSection('CHANNELS').findAllByText('Off-Topic').click();

                // # Search for the private channel
                searchForChannel(channel.name);

                // * Channel should not appear in the search results
                cy.findByTestId(channel.name).
                    should('not.exist');
            });
        });
    });

    describe('channel with', () => {
        let channelId;

        before(() => {
            // // # Visit off-topic
            cy.visit(offTopicUrl);

            const name = 'hellothere';

            // # Create a new channel
            cy.apiCreateChannel(testTeam.id, name, name).then(({channel}) => {
                channelId = channel.id;
            });

            // * Verify channel without special characters appears normally
            searchForChannel(name);

            cy.reload();
        });

        it('dots appears', () => {
            const name = 'hello.there';

            // Change name of channel
            cy.apiPatchChannel(channelId, {display_name: name});

            // * Search for channel should work
            searchForChannel(name);
        });

        it('dashes appears', () => {
            const name = 'hello-there';

            // Change name of channel
            cy.apiPatchChannel(channelId, {display_name: name});

            // * Search for channel should work
            searchForChannel(name);
        });

        it('underscores appears', () => {
            const name = 'hello_there';

            // Change name of channel
            cy.apiPatchChannel(channelId, {display_name: name});

            // * Search for channel should work
            searchForChannel(name);
        });

        it('dots, dashes, and underscores appears', () => {
            const name = 'he.llo-the_re';

            // Change name of channel
            cy.apiPatchChannel(channelId, {display_name: name});

            // * Search for channel should work
            searchForChannel(name);
        });
    });
});
