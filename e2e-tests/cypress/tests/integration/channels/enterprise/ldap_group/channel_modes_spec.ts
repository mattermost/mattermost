// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @ldap_group

describe('LDAP Group Sync - Test channel public/private toggle', () => {
    let testTeam;

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
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(1).click();
            cy.get('#saveSetting').click();
            cy.get('#confirmModalButton').click();
            return cy.apiGetChannel(channel.id);
        }).then(({channel}) => {
            assert(channel.type === 'P');
            cy.visit(`/admin_console/user_management/channels/${channel.id}`);
            cy.get('#channel_profile').contains(channel.display_name);
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(1).click();
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
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(0).click();
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(0).click();
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(1).contains('Public');
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(1).click();
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(0).click();
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(0).click();
            cy.get('#channel_manage .group-teams-and-channels--body').find('button').eq(1).contains('Private');
        });
    });

    it('MM-T4003_3 Verify that toggles are disabled for default channel', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.getCurrentChannelId().then((id) => {
            cy.visit(`/admin_console/user_management/channels/${id}`);
            cy.get('#channel_profile').contains('Town Square');
            cy.get('#channel_manage').scrollIntoView().should('be.visible').within(() => {
                cy.get('.line-switch').first().within(() => {
                    cy.findByText('Sync Group Members').should('be.visible');
                    cy.findByTestId('syncGroupSwitch-button').should('be.disabled');
                });
                cy.get('.line-switch').last().within(() => {
                    cy.findByText('Public channel or private channel').should('be.visible');
                    cy.findByTestId('allow-all-toggle-button').should('be.disabled');
                });
            });
        });
    });
});
