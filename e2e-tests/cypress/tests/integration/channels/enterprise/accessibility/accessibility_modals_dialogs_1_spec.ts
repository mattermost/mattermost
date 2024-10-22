// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @accessibility

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Verify Accessibility Support in Modals & Dialogs', () => {
    let testTeam: Team;
    let testChannel: Channel;
    let testUser: UserProfile;

    before(() => {
        // * Check if server has license for Guest Accounts
        cy.apiRequireLicenseForFeature('GuestAccounts');

        cy.apiInitSetup({userPrefix: 'user000a'}).then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser().then(({user: newUser}) => {
                cy.apiAddUserToTeam(testTeam.id, newUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, newUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as sysadmin and visit the town-square
        cy.apiAdminLogin();
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1454 Accessibility Support in Different Modals and Dialog screen', () => {
        // * Verify the accessibility support in Profile Dialog
        verifyUserMenuModal('Profile');

        // * Verify the accessibility support in Team Settings Dialog
        verifyMainMenuModal('Team Settings');

        // * Verify the accessibility support in Manage Members Dialog
        verifyMainMenuModal('Manage Members', `${testTeam.display_name} Members`);

        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // * Verify the accessibility support in Channel Edit Header Dialog
        verifyChannelMenuModal('Edit Channel Header', 'Edit Header for Off-Topic');

        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify the accessibility support in Channel Edit Purpose Dialog
        verifyChannelMenuModal('Edit Channel Purpose', 'Edit Purpose for Off-Topic');

        // * Verify the accessibility support in Rename Channel Dialog
        verifyChannelMenuModal('Rename Channel');
    });

    it('MM-T1487 Accessibility Support in Manage Channel Members Dialog screen', () => {
        // # Visit test team and channel
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Open Channel Members Dialog
        cy.get('#channelHeaderDropdownIcon').click();
        cy.findByText('Manage Members').click().wait(TIMEOUTS.FIVE_SEC);

        // * Verify the accessibility support in Manage Members Dialog
        cy.findByRole('dialog', {name: 'Off-Topic Members'}).within(() => {
            cy.findByRole('heading', {name: 'Off-Topic Members'});

            // # Set focus on search input
            cy.findByPlaceholderText('Search users').
                focus().
                type(' {backspace}').
                wait(TIMEOUTS.HALF_SEC).
                tab({shift: true}).tab();
            cy.wait(TIMEOUTS.HALF_SEC);

            // # Press tab and verify focus on first user's profile image
            cy.focused().tab();
            cy.findByAltText('sysadmin profile image').should('be.focused');

            // # Press tab and verify focus on first user's username
            cy.focused().tab();
            cy.focused().should('have.text', '@sysadmin');

            // # Press tab and verify focus on second user's profile image
            cy.focused().tab();
            cy.findByAltText(`${testUser.username} profile image`).should('be.focused');

            // # Press tab and verify focus on second user's username
            cy.focused().tab();
            cy.focused().should('have.text', `@${testUser.username}`);

            // # Press tab and verify focus on second user's dropdown option
            cy.focused().tab();
            cy.focused().should('have.class', 'dropdown-toggle').and('contain', 'Channel Member');

            // * Verify accessibility support in search total results
            cy.get('#searchableUserListTotal').should('have.attr', 'aria-live', 'polite');
        });
    });
});

function verifyMainMenuModal(menuItem: string, modalName?: string) {
    cy.uiGetLHSHeader().click();
    verifyModal(menuItem, modalName);
}

function verifyChannelMenuModal(menuItem: string, modalName?: string) {
    cy.get('#channelHeaderDropdownIcon').click();
    verifyModal(menuItem, modalName);
}

function verifyUserMenuModal(menuItem) {
    cy.uiGetSetStatusButton().click();
    verifyModal(menuItem);
}

function verifyModal(menuItem: string, modalName?: string) {
    // * Verify that menu is open
    cy.findByRole('menu');

    // # Click menu item
    cy.findByText(menuItem).click();

    // * Verify the modal
    const name = modalName || menuItem;
    cy.findByRole('dialog', {name}).within(() => {
        cy.findByRole('heading', {name});
        cy.uiClose();
    });
}
