// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @ldap_group

describe('LDAP Group Sync - Test channel public/private toggle', () => {
    let testTeam: Cypress.Team;

    before(() => {
        // * Check if server has license for LDAP Groups
        cy.apiRequireLicenseForFeature('LDAPGroups');

        // Enable LDAP and LDAP group sync
        cy.apiUpdateConfig({LdapSettings: {Enable: true}});

        // # Test LDAP configuration and server connection
        // # Synchronize user attributes
        cy.apiLDAPTest();
        cy.apiLDAPSync();

        // # Init test setup
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });
    });

    it('MM-T4003_1 Verify that System Admin can change channel privacy using toggle', () => {
        cy.apiCreateChannel(testTeam.id, 'test-channel', 'Test Channel').then(({channel}) => {
            assert(channel.type === 'O');
            cy.visit(`/admin_console/user_management/channels/${channel.id}`);
            cy.get('#channel_profile').contains(channel.display_name);
            cy.findByTestId('allow-all-toggle-private').click({force: true});
            cy.get('#saveSetting').click();
            cy.get('#confirmModalButton').click();
            return cy.apiGetChannel(channel.id);
        }).then(({channel}) => {
            assert(channel.type === 'P');
            cy.visit(`/admin_console/user_management/channels/${channel.id}`);
            cy.get('#channel_profile').contains(channel.display_name);
            cy.findByTestId('allow-all-toggle-public').click({force: true});
            cy.get('#saveSetting').click();
            cy.get('#confirmModalButton').click();
            return cy.apiGetChannel(channel.id);
        }).then(({channel}) => {
            assert(channel.type === 'O');
        });
    });

    it('MM-T4003_2 Verify that resetting sync toggle doesn\'t alter channel privacy toggle', () => {
        cy.apiCreateChannel(testTeam.id, 'test-channel', 'Test Channel').then(({channel}) => {
            assert(channel.type === 'O');
            cy.visit(`/admin_console/user_management/channels/${channel.id}`);
            cy.get('#channel_profile').contains(channel.display_name);
            cy.findByTestId('syncGroupSwitch-button').click({force: true});
            cy.findByTestId('syncGroupSwitch-button').click({force: true});
            cy.findByTestId('allow-all-toggle').within(() => {
                cy.findByText('Public channel or private channel').should('be.visible');
            });
            cy.findByTestId('allow-all-toggle-public').should('have.attr', 'aria-pressed', 'true');
            cy.findByTestId('allow-all-toggle-private').click({force: true});
            cy.findByTestId('syncGroupSwitch-button').click({force: true});
            cy.findByTestId('syncGroupSwitch-button').click({force: true});
            cy.findByTestId('allow-all-toggle').within(() => {
                cy.findByText('Public channel or private channel').should('be.visible');
            });
            cy.findByTestId('allow-all-toggle-public').should('have.attr', 'aria-pressed', 'false');
            cy.findByTestId('allow-all-toggle-private').should('have.attr', 'aria-pressed', 'true');
        });
    });

    it('MM-T4003_3 Verify that toggles are disabled for default channel', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.getCurrentChannelId().then((id) => {
            cy.visit(`/admin_console/user_management/channels/${id}`);
            cy.get('#channel_profile').contains('Town Square');
            cy.get('#channel_manage').scrollIntoView().should('be.visible').within(() => {
                cy.findByTestId('syncGroupSwitch').within(() => {
                    cy.findByText('Sync Group Members').should('be.visible');
                    cy.findByTestId('syncGroupSwitch-button').should('be.disabled');
                });
                cy.findByTestId('allow-all-toggle').within(() => {
                    cy.findByText('Public channel or private channel').should('be.visible');
                    cy.findByTestId('allow-all-toggle-public').should('be.disabled');
                    cy.findByTestId('allow-all-toggle-private').should('be.disabled');
                });
            });
        });
    });
});
