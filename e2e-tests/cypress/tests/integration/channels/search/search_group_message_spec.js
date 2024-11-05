// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @search @filesearch

describe('Search', () => {
    let testTeam;
    let testUser;
    let userOne;
    let userTwo;
    let userThree;

    before(() => {
        // # Create new team and users
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser({prefix: 'aaa'}).then(({user: user1}) => {
                userOne = user1;
                cy.apiAddUserToTeam(testTeam.id, userOne.id);
            });

            cy.apiCreateUser({prefix: 'bbb'}).then(({user: user2}) => {
                userTwo = user2;
                cy.apiAddUserToTeam(testTeam.id, userTwo.id);
            });

            cy.apiCreateUser({prefix: 'ccc'}).then(({user: user3}) => {
                userThree = user3;
                cy.apiAddUserToTeam(testTeam.id, userThree.id);
            });

            cy.apiLogin(testUser);
        });
    });

    it('S14673 - Search "in:[username]" returns results in GMs', () => {
        const groupMembers = [testUser, userOne, userTwo, userThree];
        cy.apiCreateGroupChannel(groupMembers.map((member) => member.id)).then(({channel}) => {
            cy.visit(`/${testTeam.name}/messages/${channel.name}`);

            const message = `hello${Date.now()}`;

            // # Post a message
            cy.postMessage(message);

            cy.uiGetSearchContainer().should('be.visible').click();

            //# Type "in:" text in search input
            cy.uiGetSearchBox().type('in:');

            const sortedUsernames = groupMembers.
                map((member) => member.username).
                sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));

            //# Search group members in the menu
            cy.uiGetSearchBox().find('.suggestion-list__main').contains(sortedUsernames.join(',')).click();

            //# Press enter to select
            cy.uiGetSearchBox().type('{enter}');

            //# Search for the message
            cy.uiGetSearchContainer().should('be.visible').click();
            cy.uiGetSearchBox().first().clear().type(`${message}{enter}`);

            // * Should return exactly one result from the group channel and matches the message
            cy.findAllByTestId('search-item-container').should('be.visible').and('have.length', 1).within(() => {
                cy.get('.search-channel__name').should('be.visible').and('have.text', sortedUsernames.filter((username) => username !== testUser.username).join(', '));
                cy.get('.search-highlight').should('be.visible').and('have.text', message);
            });
        });
    });

    it('Search "in:[username]" returns results file in GMs', () => {
        const groupMembers = [testUser, userOne, userTwo, userThree];
        cy.apiCreateGroupChannel(groupMembers.map((member) => member.id)).then(({channel}) => {
            cy.visit(`/${testTeam.name}/messages/${channel.name}`);

            // # Post file to group
            cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile('word-file.doc');
            cy.get('.post-image__thumbnail').should('be.visible');
            cy.uiGetPostTextBox().clear().type('{enter}');

            cy.uiGetSearchContainer().should('be.visible').click();

            //# Type "in:" text in search input
            cy.uiGetSearchBox().type('in:');

            const sortedUsernames = groupMembers.
                map((member) => member.username).
                sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));

            //# Search group members in the menu
            cy.uiGetSearchBox().find('.suggestion-list__main').contains(sortedUsernames.join(',')).click();

            //# Search for the message
            cy.uiGetSearchBox().type('word-file{enter}');

            // # Click the files tab
            cy.get('.files-tab').should('be.visible').click();

            // * Should return exactly one result from the group channel and matches the message
            cy.findAllByTestId('search-item-container').should('be.visible').and('have.length', 1).within(() => {
                cy.get('.Tag').should('be.visible').and('have.text', 'Group Message');
                cy.get('.fileDataName').should('be.visible').and('have.text', 'word-file.doc');
            });
        });
    });
});
