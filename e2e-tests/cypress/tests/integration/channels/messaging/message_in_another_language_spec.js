// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T182 Typing using CJK keyboard', () => {
        const msg = '안녕하세요';
        const msg2 = '닥터 카레브';

        // # Make a post
        cy.postMessage(msg);

        // * Check that last message do contain right message
        cy.getLastPost().should('contain', msg);

        // # Mouseover the post and click post comment icon.
        cy.clickPostCommentIcon();

        // # Post a reply in RHS.
        cy.postMessageReplyInRHS(msg2);

        // * Check that last message do contain right message
        cy.getLastPost().should('contain', msg2);
    });
});
