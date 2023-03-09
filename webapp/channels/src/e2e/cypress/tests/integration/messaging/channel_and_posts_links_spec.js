// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Message permalink', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;
    let notInChannelUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });

            cy.apiCreateUser({prefix: 'notinchannel'}).then(({user: user1}) => {
                notInChannelUser = user1;
                cy.apiAddUserToTeam(testTeam.id, notInChannelUser.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('MM-T1630 - "Jump" to convo works every time for a conversation', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Post 25 messages
        let index = 0;
        for (index = 0; index < 25; index++) {
            cy.uiGetPostTextBox().clear().type(String(index)).type('{enter}');
        }

        // # Search for a message in the current channel
        cy.get('#searchBox').clear().type('in:town-square').type('{enter}');

        // # Jump to first permalink view (most recent message)
        cy.get('.search-item__jump').first().click();

        // # Verify that we jumped to the most recent message
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('contain', index - 1);
        });

        // # Scroll to the first message
        cy.getNthPostId(-index).then((postId) => {
            // # Scroll into view
            cy.get(`#post_${postId}`).scrollIntoView();
        });

        // # Search for a message in the current channel
        cy.get('#searchBox').clear().type('in:town-square').type('{enter}');

        // # Jump to first permalink view (most recent message)
        cy.get('.search-item__jump').first().click();

        // # Verify that we jumped to the last message
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('contain', index - 1);
        });
    });

    it('MM-T2222 - Channel shortlinking - ~ autocomplete', () => {
        const publicChannelName = 'town-square';
        const publicChannelDisplayName = 'Town Square';

        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Clear then type ~ and prefix of channel name
        cy.uiGetPostTextBox().clear().type('~' + publicChannelName.substring(0, 3)).wait(TIMEOUTS.HALF_SEC);

        // * Verify that the item is displayed or not as expected.
        cy.get('#suggestionList').should('be.visible').within(() => {
            cy.findByText(publicChannelDisplayName).should('be.visible');
        });

        // # Post channel mention
        cy.uiGetPostTextBox().type('{enter}{enter}');

        // # Check that the user name has been posted
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('contain', publicChannelDisplayName);
            cy.get('a.mention-link').click();
            cy.get('#channelHeaderTitle').should('be.visible').should('contain', publicChannelDisplayName);
        });
    });

    it('MM-T2224 - Channel shortlinking - link joins public channel', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Clear then type ~ and prefix of channel name
        cy.uiGetPostTextBox().clear().type(`~${testChannel.display_name}`).wait(TIMEOUTS.HALF_SEC);

        // * Verify that the item is displayed or not as expected.
        cy.get('#suggestionList').within(() => {
            cy.findByText(testChannel.display_name).should('be.visible');
        });

        // # Post channel mention
        cy.uiGetPostTextBox().
            type('{enter}').
            should('contain', testChannel.name).
            type('{enter}');
        cy.uiWaitUntilMessagePostedIncludes(testChannel.display_name);

        cy.apiLogout();
        cy.apiLogin(notInChannelUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Check that the channel display name has been posted
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('contain', `${testChannel.display_name}`);
            cy.get('a.mention-link').click();
            cy.get('#channelHeaderTitle').should('be.visible').should('contain', `${testChannel.display_name}`);
        });
    });

    it('MM-T2234 - Permalink - auto joins public channel', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Post message
        cy.postMessage('Test');

        // # Create permalink to post
        cy.getLastPostId().then((id) => {
            const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${id}`;

            // # Click on ... button of last post
            cy.clickPostDotMenu(id);

            // # Click on "Copy Link"
            cy.uiClickCopyLink(permalink, id);

            // # Leave the channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Visit the permalink
            cy.visit(permalink);

            // # Check that the post message is the correct one
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('contain', 'Test');
            });
        });
    });

    it('MM-T2236 - Permalink - does not auto join private channel', () => {
        // # Create private channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel', 'P').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Post message
            cy.postMessage('Test');

            // # Create permalink to post
            cy.getLastPostId().then((id) => {
                const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${id}`;

                // # Click on ... button of last post
                cy.clickPostDotMenu(id);

                // # Click on "Copy Link"
                cy.uiClickCopyLink(permalink, id);

                // # Leave the channel
                cy.visit(`/${testTeam.name}/channels/town-square`);

                cy.apiLogout();
                cy.apiLogin(testUser);

                // # Visit the permalink
                cy.visit(permalink);

                // # Check the error message
                cy.findByText('Permalink belongs to a deleted message or to a channel to which you do not have access.').should('be.visible');
            });
        });
    });

    it('MM-T3471 - Clicking/tapping channel URL link joins public channel', () => {
        let tempUser;

        // # Create a temporary user
        cy.apiCreateUser({prefix: 'temp'}).then(({user: user1}) => {
            tempUser = user1;
            cy.apiAddUserToTeam(testTeam.id, tempUser.id);

            // # Login as the other user
            cy.apiLogout();
            cy.apiLogin(otherUser);
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Clear then type channel url
            cy.uiGetPostTextBox().clear().type(`${Cypress.config('baseUrl')}/${testTeam.name}/channels/${testChannel.name}`).type('{enter}');

            // # Login as the temporary user
            cy.apiLogout();
            cy.apiLogin(tempUser);
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Check that the channel permalink has been posted
            cy.getLastPostId().then(() => {
                cy.get('a.markdown__link').click();
                cy.get('#channelHeaderTitle').should('be.visible').should('contain', `${testChannel.display_name}`);
            });
        });
    });
});
