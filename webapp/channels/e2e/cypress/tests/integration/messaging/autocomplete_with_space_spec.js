// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    let testTeam;
    let testChannel;
    let testUser;

    before(() => {
        // # Login as admin and visit town-square
        cy.apiInitSetup({channelPrefix: {name: 'ask-anything', displayName: 'Ask Anything'}}).then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1662_1 Autocomplete should match entries with spaces', () => {
        const {name, display_name: displayName} = testChannel;

        [
            {input: `${name}`, isChannel: true, expected: displayName, case: 'should match on ~channelname'},
            {input: `${displayName}`, isChannel: true, expected: displayName, case: 'should match on ~channeldisplayname with space'},
            {input: `${displayName.toLowerCase()}`, isChannel: true, expected: displayName, case: 'should match on lowercase ~channeldisplayname'},
            {input: 'Ask Any', isChannel: true, expected: displayName, case: 'should match on partial ~channeldisplayname'},
            {input: 'Ask Anything ', isChannel: true, expected: displayName, case: 'should match on partial ~channeldisplayname'},
        ].forEach((testCase) => {
            verifySuggestionList(testCase);
        });
    });

    it('MM-T1662_2 Autocomplete should match entries with spaces', () => {
        const displayName = `${testUser.first_name} ${testUser.last_name} (${testUser.nickname})`;

        [
            {input: `${testUser.username}`, expected: displayName, case: 'should match on @username'},
            {input: `${testUser.first_name.toLowerCase()}`, expected: displayName, case: 'should match on lowercase @firstname'},
            {input: `${testUser.last_name.toLowerCase()}`, expected: displayName, case: 'should match on lowercase @lastname'},
            {input: `${testUser.first_name}`, expected: displayName, case: 'should match on @firstname'},
            {input: `${testUser.last_name}`, expected: displayName, case: 'should match on @lastname'},
            {input: `${testUser.first_name} ${testUser.last_name.substring(0, testUser.last_name.length - 6)}`, expected: displayName, case: 'should match on partial @fullName'},
            {input: `${testUser.first_name} ${testUser.last_name}`, expected: displayName, case: 'should match on @displayName'},
            {input: `${testUser.first_name} ${testUser.last_name} `, withoutSuggestion: true, case: 'should not match on @displayName with trailing space'},
        ].forEach((testCase) => {
            verifySuggestionList(testCase);
        });
    });
});

function verifySuggestionList({input, isChannel = false, expected, withoutSuggestion}) {
    // # Clear then type ~ or @
    cy.uiGetPostTextBox().clear().type(isChannel ? '~' : '@');

    // * Verify that the suggestion list is visible
    cy.get('#suggestionList').should('be.visible');

    // # Type input
    cy.uiGetPostTextBox().type(input);

    // * Verify that the item is displayed or not as expected.
    if (withoutSuggestion) {
        cy.get('#suggestionList').should('not.exist');
    } else {
        cy.get('#suggestionList').should('be.visible').within(() => {
            cy.findByText(expected).should('be.visible');
        });
    }
}
