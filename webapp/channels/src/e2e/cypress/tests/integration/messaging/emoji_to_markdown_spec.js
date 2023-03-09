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

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T198 Emojis preceeded by 4 or more spaces are always treated as markdown', () => {
        [
            '    :taco:',
            '     :taco:',
            '    :D',
            '     :D',
        ].forEach((message) => {
            createAndVerifyMessage(message, true);
        });

        [
            '   :taco:',
            '   :D',
        ].forEach((message) => {
            createAndVerifyMessage(message, false);
        });
    });
});

function createMessages(message, aliases) {
    cy.postMessage(message);
    cy.getLastPostId().then((postId) => {
        cy.get(`#postMessageText_${postId}`).as(aliases[0]);
        cy.clickPostCommentIcon(postId);
        cy.wait(TIMEOUTS.HALF_SEC);

        cy.postMessageReplyInRHS(message);
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#postMessageText_${lastPostId}`).as(aliases[1]);
        });
    });
}

function createAndVerifyMessage(message, isCode) {
    const aliases = ['newLineMessage', 'aliasLineMessageReplyInRHS'];
    createMessages(message, aliases);

    if (isCode) {
        aliases.forEach((alias) => {
            cy.get('@' + alias).
                find('.post-code').should('be.visible').
                find('code').should('be.visible').
                contains(message.trim());
        });
    } else {
        aliases.forEach((alias) => {
            cy.get('@' + alias).
                children().should('have.class', 'all-emoji').
                children().find('span').last().should('have.class', 'emoticon').
                and('have.attr', 'title', message.trim() === ':D' ? ':smile:' : ':taco:');
        });
    }
}
