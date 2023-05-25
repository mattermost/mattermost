// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({townSquareUrl}) => {
            cy.visit(townSquareUrl);
        });
    });

    it("MM-T165 Windows: Custom emoji don't overlap", () => {
        // # Post a message
        const emojis = '😈🤣👘😘😋😋😛🤨😎😏😛🤓😋😖🤨😫😫😚😒😋☹️🤨😒😒🤪😖😋😒😋🤨😏😩🤨😀🤨😇🧐🙃🤨🙃😟😛😔🧐☹️🤬😱😳🤫🤫😥😳🤔😨🤗😢😑🤢🤢🤢🤮🤮😪😑😑🤔😴🤭😵😑😷🤐🤐👙👨‍👧‍👧👨‍👨‍👧‍👦👚👩‍👦‍👦👔👩‍👧‍👦👠👩‍👦‍👦👨‍👦‍👦';
        cy.postMessage(emojis);

        cy.get('.emoticon').then((allEmoticons) => {
            for (let index = 0; index < allEmoticons.length - 1; index++) {
                const emoticon = allEmoticons[index];
                const emoticonToCompare = allEmoticons[index + 1];

                // * Compare emojis on same row not to have overlap
                if (emoticon.getBoundingClientRect().top === emoticonToCompare.getBoundingClientRect().top) {
                    cy.wrap(emoticon.getBoundingClientRect().right).should('be.lte', emoticonToCompare.getBoundingClientRect().left);
                }
            }
        });
    });
});
