// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Compact view: Markdown quotation', () => {
    let testTeam;
    let userOne;
    let userTwo;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            userOne = user;

            cy.apiCreateUser().then(({user: user2}) => {
                userTwo = user2;
                cy.apiAddUserToTeam(team.id, userTwo.id);
            });
        });
    });

    it('MM-T185 Compact view: Markdown quotation', () => {
        cy.apiLogin(userOne);
        cy.apiCreateDirectChannel([userOne.id, userTwo.id]).then(() => {
            cy.visit(`/${testTeam.name}/messages/@${userTwo.username}`);

            // # Post first message in case it is a new Channel
            cy.postMessage('Hello' + Date.now());

            // # Make sure we are on compact mode
            cy.apiSaveMessageDisplayPreference('compact');

            resetRoot(testTeam, userOne, userTwo);

            // # Post message to use and check
            const message = '>Hello' + Date.now();
            cy.postMessage(message);
            checkQuote(message);

            resetRoot(testTeam, userOne, userTwo);

            // # Post two messages and check
            cy.postMessage('Hello' + Date.now());
            cy.postMessage(message);
            checkQuote(message);
        });
    });

    function resetRoot(team, user1, user2) {
        // # Write a message from user2 to make sure we have the root on compact mode
        cy.apiLogout();
        cy.apiLogin(user2);
        cy.visit(`/${testTeam.name}/messages/@${user1.username}`);
        cy.postMessage('Hello' + Date.now());

        // # Get back to user1
        cy.apiLogout();
        cy.apiLogin(user1);
        cy.visit(`/${testTeam.name}/messages/@${user2.username}`);
    }

    function checkQuote(message) {
        cy.getLastPostId().then((postId) => {
            // * Check if the message is the same sent
            cy.get(`#postMessageText_${postId} > blockquote > p`).should('be.visible').and('have.text', message.slice(1));
            cy.findAllByTestId('postView').filter('.other--root').last().find('.user-popover').then((userElement) => {
                // # Get the username bounding rect
                const userRect = userElement[0].getBoundingClientRect();
                cy.get(`#postMessageText_${postId}`).find('blockquote').then((quoteElement) => {
                    // # Get the quote block bounding rect
                    const blockQuoteRect = quoteElement[0].getBoundingClientRect();

                    // * We check the username rect does not collide with the quote rect
                    expect(userRect.right < blockQuoteRect.left || userRect.bottom < blockQuoteRect.top).to.equal(true);
                });
            });
        });
    }
});
