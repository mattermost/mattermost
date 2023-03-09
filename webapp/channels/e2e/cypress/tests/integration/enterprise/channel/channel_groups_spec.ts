// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @ldap_group

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('channel groups', () => {
    const groups = [];
    let testTeam;

    before(() => {
        cy.apiRequireLicenseForFeature('LDAP');

        // # Link 2 groups
        cy.apiGetLDAPGroups().then((result) => {
            for (let i = 0; i < 2; i++) {
                cy.apiLinkGroup(result.body.groups[i].primary_key).then((response) => {
                    groups.push(response.body);
                });
            }
        });

        cy.apiUpdateConfig({LdapSettings: {Enable: true}, ServiceSettings: {EnableTutorial: false}});

        // # Create a new team and associate one group to the team
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            testTeam = team;
            cy.apiLinkGroupTeam(groups[0].id, team.id);

            // # Group-constrain the channel
            cy.apiGetChannelByName(testTeam.name, 'off-topic').then(({channel}) => {
                cy.apiPatchChannel(channel.id, {group_constrained: true});
            });
        });
    });

    after(() => {
        cy.apiDeleteTeam(testTeam.id, true);
        for (let i = 0; i < 2; i++) {
            cy.apiUnlinkGroup(groups[i].remote_id);
        }
    });

    it('limits the listed groups if the parent team is group-constrained', () => {
        // # Visit a channel
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Open the Add Groups modal
        openAddGroupsToChannelModal();

        // * Ensure at least 2 groups are listed
        let beforeCount;
        cy.get('#addGroupsToChannelModal').find('.more-modal__row').then((items) => {
            beforeCount = Cypress.$(items).length;
        });
        cy.get('#addGroupsToChannelModal').find('.more-modal__row').its('length').should('be.gte', 2);

        // # Group-constrain the parent team
        cy.apiPatchTeam(testTeam.id, {group_constrained: true});
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Close and re-open the Add Groups modal again
        openAddGroupsToChannelModal();

        // * Ensure that only 1 group is listed
        cy.get('#addGroupsToChannelModal').find('.more-modal__row').then((items) => {
            const newCount = beforeCount - 1;
            expect(items).to.have.length(newCount);
        });
    });
});

function openAddGroupsToChannelModal() {
    cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).click();
    cy.get('#channelManageGroups').should('be.visible');
    cy.get('#channelManageGroups').click();
    cy.findByText('Add Groups').should('exist');
    cy.findByText('Add Groups').click();
    cy.get('#addGroupsToChannelModal').should('be.visible');
}
