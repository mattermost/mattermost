// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @ldap_group

import * as TIMEOUTS from '../../../fixtures/timeouts';

// # Save setting and get back to the resource page
const saveAndNavigateBackTo = (name, displayName, page) => {
    cy.get('#saveSetting').should('be.enabled').click().wait(TIMEOUTS.HALF_SEC);

    // * Verify that it redirects to page and wait for a while to load
    cy.url().should('include', `/admin_console/user_management/${page}`).wait(TIMEOUTS.TWO_SEC);
    cy.get('.DataGrid_searchBar').within(() => {
        cy.findByPlaceholderText('Search').should('be.visible').type(`${displayName}{enter}`).wait(TIMEOUTS.HALF_SEC);
    });
    cy.findByTestId(`${name}edit`).should('be.visible').click();
};

const changeRole = (type, fromRole, toRole) => {
    // # Wait for data grid to load
    cy.get(`#${type}Members`).scrollIntoView().within(() => {
        cy.get('.UserGrid_nameRow').should('be.visible');
    });

    // * Ensure current role is fromRole then click
    cy.get(`#${type}_groups`).scrollIntoView().findByTestId('current-role').should('have.text', fromRole).click();

    // # Change role
    cy.get('#role-to-be-menu').then((el) => {
        // * Assert that only one option exists in the dropdown for changing roles
        expect(el[0].firstElementChild.children.length).equal(1);

        // # Click on toRole
        cy.wrap(el).findByText(toRole).click().wait(TIMEOUTS.HALF_SEC);
    });
};

describe('System Console', () => {
    const groupDisplayName = 'board';
    let testTeam;
    let teamName;
    let teamDisplayName;
    let channelName;
    let channelDisplayName;

    before(() => {
        // * Check if server has license for LDAP Groups
        cy.apiRequireLicenseForFeature('LDAPGroups');

        cy.apiInitSetup({
            teamPrefix: {name: 'a-team', displayName: 'A Team'},
            channelPrefix: {name: 'a-channel', displayName: 'A Channel'},
        }).then(({team, channel}) => {
            testTeam = team;
            teamName = team.display_name;
            teamDisplayName = team.display_name;
            channelName = channel.name;
            channelDisplayName = channel.display_name;

            cy.apiGetLDAPGroups().then((res) => {
                res.body.groups.forEach((group) => {
                    if (group.name === groupDisplayName) {
                        cy.apiAddLDAPGroupLink(group.primary_key);
                    }
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiGetTeamGroups(testTeam.id).then((resGroups) => {
            resGroups.body.groups.forEach((group) => {
                if (group.display_name === groupDisplayName) {
                    cy.apiDeleteLinkFromTeamToGroup(group.id, testTeam.id);
                }
            });
        });
    });

    it('MM-20059 - System Admin can map roles to groups from Team Configuration screen', () => {
        // # Go to system admin page and to team configuration page
        cy.visit('/admin_console/user_management/teams');

        // # Search for the team.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').should('be.visible').type(`${teamDisplayName}{enter}`);
        });
        cy.findByTestId(`${teamName}edit`).click();

        // # Add the first group in the group list then save
        cy.findByTestId('addGroupsToTeamToggle').scrollIntoView().click();
        cy.get('#multiSelectList').should('be.visible');
        cy.get('#multiSelectList>div').children().eq(0).click();
        cy.get('#saveItems').click();

        // # Change role from Member to Team Admin
        changeRole('team', 'Member', 'Team Admin');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(teamName, teamDisplayName, 'teams');

        // # Change role from Team Admin to Member
        changeRole('team', 'Team Admin', 'Member');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(teamName, teamDisplayName, 'teams');

        // * Check to make the the current role text is displayed as Member
        cy.get('#team_groups').scrollIntoView().findByTestId('current-role').should('have.text', 'Member');

        // # Wait for the board group to show up before continuing to next steps
        cy.waitUntil(() => cy.get('.group-row').eq(0).scrollIntoView().find('.group-name').then((el) => {
            return el[0].innerText === groupDisplayName;
        }), {
            errorMsg: `${groupDisplayName} group didn't show up in time`,
            timeout: TIMEOUTS.TEN_SEC,
        });

        // # Remove "board" group
        cy.get('.group-row').eq(0).scrollIntoView().should('be.visible').within(() => {
            cy.get('.group-name').should('have.text', groupDisplayName);
            cy.get('.group-actions > a').should('have.text', 'Remove').click();
        });

        // * Assert that the group was removed successfully
        cy.get('#groups-list--body').should('be.visible').contains('No groups specified yet');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(teamName, teamDisplayName, 'teams');

        // * Assert that the group was removed successfully
        cy.get('#groups-list--body').scrollIntoView().should('be.visible').contains('No groups specified yet');
    });

    it('MM-21789 - Add a group and change the role and then save and ensure the role was updated on team configuration page', () => {
        // # Go to system admin page and to team configuration page
        cy.visit('/admin_console/user_management/teams');

        // # Search for the team.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').should('be.visible').type(`${teamDisplayName}{enter}`);
        });
        cy.findByTestId(`${teamName}edit`).click();

        // # Add the first group in the group list then save
        cy.findByTestId('addGroupsToTeamToggle').click();
        cy.get('#multiSelectList').should('be.visible');
        cy.get('#multiSelectList>div').children().eq(0).click();
        cy.get('#saveItems').click();

        // # Change role from Member to Team Admin
        changeRole('team', 'Member', 'Team Admin');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(teamName, teamDisplayName, 'teams');

        // * Check to make the the current role text is displayed as Team Admin
        cy.get('#team_groups').scrollIntoView().findByTestId('current-role').should('have.text', 'Team Admin');
    });

    it('MM-20646 - System Admin can map roles to groups from Channel Configuration screen', () => {
        // # Go to system admin page and to channel configuration page of channel "autem"
        cy.visit('/admin_console/user_management/channels');

        // # Search for the channel.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').should('be.visible').type(`${channelDisplayName}{enter}`);
        });
        cy.findByTestId(`${channelName}edit`).click();

        // # Add the first group in the group list then save
        cy.get('#addGroupsToChannelToggle').click();
        cy.get('#multiSelectList').should('be.visible');
        cy.get('#multiSelectList>div').children().eq(0).click();
        cy.get('#saveItems').click();

        // # Change role from Member to Channel Admin
        changeRole('channel', 'Member', 'Channel Admin');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(channelName, channelDisplayName, 'channels');

        // # Change role from Channel Admin to Member
        changeRole('channel', 'Channel Admin', 'Member');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(channelName, channelDisplayName, 'channels');

        // * Check to make the the current role text is displayed as Member
        cy.get('#channel_groups').scrollIntoView().findByTestId('current-role').should('have.text', 'Member');
    });

    it('MM-21789 - Add a group and change the role and then save and ensure the role was updated on channel configuration page', () => {
        // # Go to system admin page and to channel configuration page of channel "autem"
        cy.visit('/admin_console/user_management/channels');

        // # Search for the channel.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').should('be.visible').type(`${channelDisplayName}{enter}`);
        });
        cy.findByTestId(`${channelName}edit`).click();

        // # Add the first group in the group list then save
        cy.get('#addGroupsToChannelToggle').click();
        cy.get('#multiSelectList').should('be.visible');
        cy.get('#multiSelectList>div').children().eq(0).click();
        cy.get('#saveItems').click();

        // # Change role from Member to Channel Admin
        changeRole('channel', 'Member', 'Channel Admin');

        // # Save the setting and navigate back to page
        saveAndNavigateBackTo(channelName, channelDisplayName, 'channels');

        // * Check to make the the current role text is displayed as Channel Admin
        cy.get('#channel_groups').scrollIntoView().findByTestId('current-role').should('have.text', 'Channel Admin');
    });
});
