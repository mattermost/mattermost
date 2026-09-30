// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @not_cloud

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Messaging', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('MM-T5669 Navigating DM list using Up/Down arrow keys scrolls it', () => {
        // # Login as test user and visit town-square
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Click on '+' sign to open DM modal
        cy.uiAddDirectMessage().click().wait(TIMEOUTS.ONE_SEC);

        // * Verify that the DM modal is open
        cy.get('#moreDmModal').should('be.visible').contains('Direct Messages');

        // # Check the DM list for the first user that's out of view.
        cy.get('#multiSelectList').then((dmList) => {
            const dmListBottom = dmList[0].getBoundingClientRect().bottom;

            cy.get('#multiSelectList>div').each((listItem, index, listItems) => {
                const itemBottom = listItem[0].getBoundingClientRect().bottom;

                if (itemBottom > dmListBottom) {
                    // # Press the DOWN arrow key to scroll down to the user out of view.
                    for (let i = 0; i <= index; i++) {
                        cy.get('#moreDmModal').trigger('keydown', {key: 'ArrowDown'});
                    }

                    // * Verify the active item (5th) is visible/scrolled into view.
                    cy.wrap(listItem).should('be.visible');

                    // # Press the UP arrow key to scroll back up to the first user that's now out of view.
                    for (let i = 0; i <= index; i++) {
                        cy.get('#moreDmModal').trigger('keydown', {key: 'ArrowUp'});
                    }

                    // * Verify the active item (1st) is visible/scrolled into view.
                    cy.wrap(listItems[0]).should('be.visible');

                    return false;
                }

                return listItems;
            });
        });
    });
});
