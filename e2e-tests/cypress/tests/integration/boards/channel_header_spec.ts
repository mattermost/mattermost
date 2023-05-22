// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @boards

describe('channels > channel header', {testIsolation: true}, () => {
    let testTeam: {name: string};
    let testUser: {username: string};

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);
        });
    });

    describe('App Bar enabled', () => {
        it('webapp should hide the Boards channel header button', () => {
            cy.apiAdminLogin();
            cy.apiUpdateConfig({ExperimentalSettings: {EnableAppBar: true}});

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Navigate directly to a channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify channel header button is not showing
            cy.get('#channel-header').within(() => {
                cy.get('[data-testid="boardsIcon"]').should('not.exist');
            });
        });
    });

    describe('App Bar disabled', () => {
        beforeEach(() => {
            cy.apiAdminLogin();
            cy.apiUpdateConfig({ExperimentalSettings: {EnableAppBar: false}});

            // # Login as testUser
            cy.apiLogin(testUser);
        });

        it('webapp should show the Boards channel header button', () => {
            // # Navigate directly to a channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify channel header button is showing
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist');
            });
        });

        it('tooltip text should show "Boards" for Boards channel header button', () => {
            // # Navigate directly to a channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Hover over the channel header icon
            cy.get('#channel-header').within(() => {
                cy.get('[data-testid="boardsIcon"]').trigger('mouseover');
            });

            // * Verify tooltip text
            cy.get('#pluginTooltip').contains('Boards');
        });

        it('webapp should make the Boards channel header button active when opened', () => {
            // # Navigate directly to a channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            cy.get('#channel-header').within(() => {
                // # Click the channel header button
                cy.get('[data-testid="boardsIcon"]').as('icon').click();

                // * Verify channel header button is showing active className
                cy.get('@icon').parent().
                    should('have.class', 'channel-header__icon--active-inverted');
            });
        });
    });
});
