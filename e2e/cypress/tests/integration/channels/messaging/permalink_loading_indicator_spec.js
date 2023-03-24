// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Messaging', () => {
    let testTeam;
    let testPrivateChannel;
    let testPublicChannel;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            testTeam = team;
            testPublicChannel = channel;

            cy.apiCreateChannel(testTeam.id, 'private', 'Private', 'P').then((out) => {
                testPrivateChannel = out.channel;
            });

            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T3308 Permalink to first post in channel does not show endless loading indicator above', () => {
        const message = getRandomId();
        const maxMessageCount = 10;

        // # Click on test private channel
        cy.get('#sidebarItem_' + testPrivateChannel.name).click({force: true});

        // # Post several messages
        for (let i = 1; i <= maxMessageCount; i++) {
            cy.postMessage(`${message}-${i}`);
        }

        // # Get first post id from that postlist area
        cy.getNthPostId(-maxMessageCount).then((permalinkPostId) => {
            const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${permalinkPostId}`;

            // # Click on ... button of last post
            cy.clickPostDotMenu(permalinkPostId);

            // # Click on "Copy Link"
            cy.uiClickCopyLink(permalink, permalinkPostId);

            // # Click on test public channel
            cy.get('#sidebarItem_' + testPublicChannel.name).click({force: true});

            // # Paste link on postlist area
            cy.postMessage(permalink);
            cy.uiWaitUntilMessagePostedIncludes(permalink);

            // # Get last post id from that postlist area
            cy.getLastPostId().then((postId) => {
                // # Click on permalink
                cy.get(`#postMessageText_${postId} > p > .markdown__link`).scrollIntoView().click();

                // * Check if url include the permalink
                cy.url().should('include', `/${testTeam.name}/channels/${testPrivateChannel.name}/${permalinkPostId}`);

                // * Check if url redirects back to parent path eventually
                cy.wait(TIMEOUTS.FIVE_SEC).url().should('include', `/${testTeam.name}/channels/${testPrivateChannel.name}`).and('not.include', `/${permalinkPostId}`);

                // * Check if the matching channel intro title is visible
                cy.get('#channelIntro').contains('.channel-intro__title', `Beginning of ${testPrivateChannel.display_name}`).scrollIntoView().should('be.visible');
            });

            // # Get last post id from open channel
            cy.getLastPostId().then((clickedPostId) => {
                // * Check the sent message
                cy.get(`#postMessageText_${clickedPostId}`).scrollIntoView().should('be.visible').and('have.text', `${message}-${maxMessageCount}`);

                // * Check if the loading indicator is not visible
                cy.get('.loading-screen').should('not.exist');

                // * Check if the more messages text is not visible
                cy.get('.more-messages-text').should('not.exist');
            });
        });
    });
});
