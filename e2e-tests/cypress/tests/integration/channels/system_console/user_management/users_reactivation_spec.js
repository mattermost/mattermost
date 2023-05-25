// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';
import * as MESSAGES from '../../../../fixtures/messages';

import {getRandomId} from '../../../../utils';

describe('System Console > User Management > Reactivation', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Do initial setup
        cy.apiInitSetup().then(({team}) => {
            // # Visit town-square
            cy.visit(`/${team.name}`);
        });
    });

    it('MM-T952 Reactivating a user results in them showing up in the normal spot in the list, without the `Deactivated` label.', () => {
        // # Create two users with same random prefix
        const id = getRandomId();

        cy.apiCreateUser({prefix: id + '_a_'}).then(({user: user1}) => {
            cy.apiCreateUser({prefix: id + '_b_'}).then(({user: user2}) => {
                // # Send a DM to user1 so they show up in the DM modal
                cy.sendDirectMessageToUser(user1, MESSAGES.SMALL);

                // # Send a DM to user2 so they show up in the DM modal
                cy.sendDirectMessageToUser(user2, MESSAGES.SMALL);

                // # Open DM More... Modal
                cy.uiAddDirectMessage().click().wait(TIMEOUTS.HALF_SEC);

                // # Type the user name of the other user on Channel switcher input
                cy.get('.more-direct-channels #selectItems input').typeWithForce(id).wait(TIMEOUTS.HALF_SEC);

                // * Verify user 1 is shown first and doesn't have deactivated text
                cy.get('#moreDmModal .more-modal__row').siblings().its(0).get('#displayedUserName' + user1.username).parent().should('not.contain', 'Deactivated');

                // * Verify user 2 is shown second
                cy.get('#moreDmModal .more-modal__row').siblings().its(1).get('#displayedUserName' + user2.username);

                // # Deactivate user1
                cy.apiDeactivateUser(user1.id).then(() => {
                    // * Verify user 1 is shown second and does have deactivated text
                    cy.get('#moreDmModal .more-modal__row').siblings().its(1).get('#displayedUserName' + user1.username).parent().should('contain', 'Deactivated');

                    // * Verify user 2 is shown first
                    cy.get('#moreDmModal .more-modal__row').siblings().its(0).get('#displayedUserName' + user2.username);

                    // # Reactivate user1
                    cy.apiActivateUser(user1.id).then(() => {
                        // * Verify user 1 is shown first and doesn't have deactivated text
                        cy.get('#moreDmModal .more-modal__row').siblings().its(0).get('#displayedUserName' + user1.username).parent().should('not.contain', 'Deactivated');

                        // * Verify user 2 is shown second
                        cy.get('#moreDmModal .more-modal__row').siblings().its(1).get('#displayedUserName' + user2.username);
                    });
                });
            });
        });
    });
});
