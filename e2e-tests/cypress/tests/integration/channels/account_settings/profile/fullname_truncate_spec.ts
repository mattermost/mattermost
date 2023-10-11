// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import {getRandomId} from '../../../../utils';

describe('Profile > Profile Settings> Full Name', () => {
    let firstUser;
    let secondUser;
    const firstName = 'This Is a Long Name';
    const lastName = 'That Should Truncate';

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            firstUser = user;
            cy.apiCreateUser().then(({user: user1}) => {
                secondUser = user1;
                cy.apiAddUserToTeam(team.id, secondUser.id);

                cy.apiLogin(firstUser);
                cy.visit(offTopicUrl);
            });
        });
    });

    it('MM-T2046 Full Name - Truncated in popover', () => {
        // # Go to Profile -> Profile Settings -> Full Name -> Edit
        cy.uiOpenProfileModal('Profile Settings');

        // # Open Full Name section
        cy.get('#nameDesc').click();

        // # Enter First Name `This Is a Very Long Name`
        cy.get('#firstName').clear().type(firstName);

        // # Enter Last Name `That Should Truncate`
        cy.get('#lastName').clear().type(lastName);

        // # Save
        cy.get('#saveSetting').click();

        // * Full name field shows first and last name.
        cy.contains('#nameDesc', `${firstName} ${lastName}`);

        // # Close profile settings modal
        cy.uiClose();
    });

    it('MM-T2047 Truncated in popover (visual verification)', () => {
        // # Open user profile popover
        cy.postMessage(`this is a test message ${getRandomId()}`);
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).should('be.visible');
            cy.get(`#post_${postId} img`).click();
            cy.get('#user-profile-popover').should('be.visible');

            // * Popover user name should show truncated to 'This Is a Long Name That Should Tr...'
            cy.findByTestId(`popover-fullname-${firstUser.username}`).should('have.css', 'text-overflow', 'ellipsis');
        });
    });

    it('MM-T2048 Empty full name: @ still displays before username', () => {
        // # Open any user list ("View Members", "Add Members", "Manage Members", ..)
        cy.uiOpenTeamMenu('View Members');

        // # Find a user who hasn't set their full name
        cy.get('.modal-title').should('be.visible');
        cy.get('#searchUsersInput').should('be.visible').type(secondUser.nickname);

        // * Username is preceded with `@`, consistent with other users
        cy.contains('button.user-popover', `@${secondUser.username}`);
    });
});
