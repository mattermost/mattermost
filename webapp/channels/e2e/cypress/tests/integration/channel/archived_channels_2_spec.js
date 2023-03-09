// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel

import {getAdminAccount} from '../../support/env';
import {getRandomId} from '../../utils';

describe('Leave an archived channel', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as test user and visit off-topic
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/off-topic`);
    });

    it('MM-T1687 App does not crash when another user archives a channel', () => {
        cy.makeClient({user: getAdminAccount()}).then((client) => {
            // # Have another user create a private channel
            const channelName = `channel${getRandomId()}`;
            cy.wrap(client.createChannel({
                display_name: channelName,
                name: channelName,
                team_id: testTeam.id,
                type: 'P',
            })).then(async (channel) => {
                // # Then invite us to it
                await client.addToChannel(testUser.id, channel.id);

                cy.wrap(channel);
            }).then((channel) => {
                // * Verify that the newly created channel is in the sidebar
                cy.get(`#sidebarItem_${channel.name}`).should('be.visible');

                cy.wrap(channel);
            }).then(async (channel) => {
                // # Then archive the channel
                await client.deleteChannel(channel.id);

                // * Verify that the channel is no longer in the sidebar and that the app hasn't crashed
                cy.get(`#sidebarItem_${channel.name}`).should('not.exist');
            });
        });
    });

    it('MM-T1688 archived channels only appear in search results as long as the user does not leave them', () => {
        // # Create a new channel
        cy.uiCreateChannel({isNewSidebar: true}).then(({name: channelName}) => {
            // # Make a post
            const archivedPostText = `archived${getRandomId()}`;
            cy.postMessage(archivedPostText);
            cy.getLastPostId().then((archivedPostId) => {
                // # Archive the newly created channel
                cy.uiArchiveChannel();

                // # Switch away from the archived channel
                cy.get('#sidebarItem_off-topic').click();

                // * Verify that the channel is no longer in the sidebar
                cy.get(`#sidebarItem_${channelName}`).should('not.exist');

                // # Search for the post
                cy.uiSearchPosts(archivedPostText);

                // * Verify that the post is shown in the search results
                cy.get(`#searchResult_${archivedPostId}`).should('be.visible');

                // # Switch back to the archived channel through the permalink
                cy.uiJumpToSearchResult(archivedPostId);

                // * Wait for the permalink URL to disappear
                cy.url().should('include', `/${testTeam.name}/channels/${channelName}`);

                // # Leave the channel
                cy.uiLeaveChannel();
                cy.url().should('include', `/${testTeam.name}/channels/off-topic`);
                cy.postMessage('hello');

                // # Search for the post again
                cy.uiSearchPosts(archivedPostText);

                // * Verify that the post is no longer shown in the search results
                cy.get(`#searchResult_${archivedPostId}`).should('not.exist');
                cy.get('#search-items-container .no-results__wrapper').should('be.visible');
            });
        });
    });
});
