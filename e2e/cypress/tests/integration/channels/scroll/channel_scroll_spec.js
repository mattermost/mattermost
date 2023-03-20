// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @scroll

import * as MESSAGES from '../../../fixtures/messages';
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
        });
    });

    it('MM-T2378 Channel with only a few posts opens at the bottom', () => {
        // # Post a starting message with user 1
        cy.postMessage('This is the first post');

        // # Post as few as messages so that scroll bar appears as channel name scroll hidden
        Cypress._.times(20, (postIndex) => {
            cy.postMessage(`p-${postIndex + 1}`);
        });

        // # Post the last message
        cy.postMessage('This is the last post');

        // # Reload the browser
        cy.reload();

        // * Verify that the top of the channel is scrolled past hidden
        cy.findByText(`Beginning of ${testChannel.display_name}`).should('exist').and('not.be.visible');

        // * Verify that the last message is visible implying that channel scrolled to bottom on reload
        cy.findByText('This is the last post').should('exist').and('be.visible');
    });

    it('MM-T2382 Center channel scroll', () => {
        // # Post a starting message with user 1
        cy.postMessage('This is the first post');

        // # Make enough posts so that first post is scrolled past hidden
        Cypress._.times(30, (postIndex) => {
            cy.postMessage(`p-${postIndex + 1}`);
        });

        // * Verify that we are the bottom of the channel
        cy.findByText('This is the first post').should('exist').and('not.be.visible');

        // * Make post from another user and verify that channel is scrolled down as post appear
        Cypress._.times(3, (postIndex) => {
            postMessageAndcheckIfTopMessagesAreScrolled(postIndex + 1, otherUser, testChannel.id);
        });
    });

    it('MM-T2367 Compact view', () => {
        const message = 'This is the first post';

        // # Set display mode to standard
        cy.apiSaveMessageDisplayPreference('clean');

        // # Post a starting message with user 1
        Cypress._.times(2, () => {
            cy.postMessage(message);
        });

        // * Verify that messages do no have user's name in post
        cy.getLastPostId().then((parentMessageId) => {
            cy.get(`#${parentMessageId}_message`).invoke('text').then((text) => {
                expect(text).to.equal(message);
                expect(text).to.not.have.string('sysadmin');
            });
        });

        // # Set display mode to compact
        cy.apiSaveMessageDisplayPreference('compact');
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Verify that messages have user's name in post
        cy.getLastPostId().then((parentMessageId) => {
            cy.get(`#${parentMessageId}_message`).parent().invoke('text').then((text) => {
                expect(text).to.contain('sysadmin');
                expect(text).to.contain(message);
            });
        });
    });

    // https://automation-test-cases.vercel.app/test/MM-T2374
    it('MM-T2374 System Messages', () => {
        const firstPost = '<< This is the first post><';
        const lastPost = '<< This is the last post><';

        // # Make an opening first post
        cy.postMessage(firstPost);

        // # Make enough post so the channel can scroll sufficiently
        Cypress._.times(6, () => {
            cy.uiPostMessageQuickly(MESSAGES.LARGE);
            cy.uiPostMessageQuickly(MESSAGES.MEDIUM);
        });

        // # Make a final post
        cy.postMessage(lastPost);

        // # Scroll to top
        cy.get('div.post-list__dynamic').should('be.visible').scrollTo('top', {duration: TIMEOUTS.ONE_SEC}).wait(TIMEOUTS.ONE_SEC);

        // * Verify we are on the top of the channel
        cy.findByText(firstPost).should('exist').and('be.visible');
        cy.findByText(lastPost).should('exist').and('not.be.visible');

        // # Add few users to the same channel
        cy.apiCreateUser().then(({user: userAddRemove1}) => {
            cy.apiAddUserToTeam(testTeam.id, userAddRemove1.id).then(() => {
                cy.apiAddUserToChannel(testChannel.id, userAddRemove1.id);

                cy.wait(TIMEOUTS.THREE_SEC);

                cy.apiCreateUser().then(({user: userAddRemove2}) => {
                    cy.apiAddUserToTeam(testTeam.id, userAddRemove2.id).then(() => {
                        cy.apiAddUserToChannel(testChannel.id, userAddRemove2.id);

                        cy.wait(TIMEOUTS.THREE_SEC);

                        cy.apiCreateUser().then(({user: userAddRemove3}) => {
                            cy.apiAddUserToTeam(testTeam.id, userAddRemove3.id).then(() => {
                                cy.apiAddUserToChannel(testChannel.id, userAddRemove3.id);

                                // # Wait a little before we can start removing
                                cy.wait(TIMEOUTS.FIVE_SEC);

                                // # Remove few users from the same channel
                                cy.removeUserFromChannel(testChannel.id, userAddRemove1.id);

                                cy.wait(TIMEOUTS.THREE_SEC);

                                cy.removeUserFromChannel(testChannel.id, userAddRemove2.id);

                                // # Wait a little after we removed the users
                                cy.wait(TIMEOUTS.FIVE_SEC);
                            });
                        });
                    });
                });
            });
        });

        // * Verify we are still on the top of the channel and no scrolling occured
        cy.findByText(firstPost).should('exist').and('be.visible');
        cy.findByText(lastPost).should('exist').and('not.be.visible');
    });
});

function postMessageAndcheckIfTopMessagesAreScrolled(postIndex, sender, channelId) {
    // # Make posts from other user
    cy.postMessageAs({sender, message: `Other users p-${postIndex}`, channelId});

    cy.get('#post-list').should('exist').within(() => {
        // * Verify that top post are hidden behind scroll
        cy.findByText(`p-${postIndex}`).should('exist').and('not.be.visible');
        cy.findByText(`p-${postIndex + 1}`).should('exist').and('not.be.visible');

        // * Also verify that latest messages from the other user are visible
        cy.findByText(`Other users p-${postIndex}`).should('exist').and('be.visible');
    });
}
