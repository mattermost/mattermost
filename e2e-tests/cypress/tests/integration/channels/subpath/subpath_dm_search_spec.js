// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @subpath

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {generateRandomUser} from '../../../support/api/user';
import {getAdminAccount} from '../../../support/env';

describe('Subpath Direct Message Search', () => {
    let testTeam;

    before(() => {
        cy.shouldRunWithSubpath();

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            cy.apiLogin(user);
        });
    });

    it('MM-T989 - User on other subpath, but not on this one, should not show in DM More list', () => {
        const admin = getAdminAccount();
        const secondServer = Cypress.env('secondServerURL');

        // # Log into admin account of other subpath server
        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: `${secondServer}/api/v4/users/login`,
            method: 'POST',
            body: {login_id: admin.username, password: admin.password},
        }).then((response) => {
            expect(response.status).to.equal(200);

            // # Create a user on other subpath server
            const newUser = generateRandomUser('otherSubpathUser');
            const createUserOption = {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                method: 'POST',
                url: `${secondServer}/api/v4/users`,
                body: newUser,
            };
            cy.request(createUserOption).then((userRes) => {
                expect(userRes.status).to.equal(201);
                const otherSubpathUser = userRes.body;

                // # Go to town square channel of primary subpath server
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // # Open DM modal
                cy.uiAddDirectMessage().click().wait(TIMEOUTS.HALF_SEC);

                // # Search for username from other subpath server
                cy.get('#selectItems input').
                    typeWithForce(otherSubpathUser.username).
                    wait(TIMEOUTS.HALF_SEC);

                // * Verify username does not show up in search result
                cy.get(`#displayedUserName${otherSubpathUser.username}`).should('not.exist');
            });
        });
    });
});
