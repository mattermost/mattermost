// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @accessibility

describe('Verify Accessibility Support in Dropdown Menus', () => {
    let offTopicUrl;

    before(() => {
        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);

            cy.apiInitSetup().then(({offTopicUrl: url}) => {
                offTopicUrl = url;
            });

            cy.apiCreateTeam('other-team', 'Other Team');
        });
    });

    beforeEach(() => {
        // Visit the Off Topic channel
        cy.visit(offTopicUrl);
        cy.postMessage('hello');
    });

    it('MM-T1464 Accessibility Support in Channel Menu Dropdown', () => {
        // # Press tab from the Channel Favorite button
        cy.uiGetChannelFavoriteButton().
            focus().
            tab({shift: true}).
            tab().
            tab({shift: true});

        // * Verify the aria-label in channel menu button
        cy.uiGetChannelHeaderButton().
            findByLabelText('channel menu').
            should('be.focused').click();

        // * Verify the accessibility support in the Channel Dropdown menu
        cy.uiGetChannelMenu().
            parent().
            should('have.attr', 'aria-label', 'channel menu').
            and('have.attr', 'role', 'menu');

        // * Verify the first option is not selected by default
        cy.uiGetChannelMenu().children().eq(0).should('not.be.focused');

        // # Press tab
        cy.focused().tab();

        // * Verify the accessibility support in the Channel Dropdown menu items
        const menuItems = [
            'View Info',
            'Move to...',
            'Notification Preferences',
            'Mute Channel',
            'Add Members',
            'Manage Members',
            'Edit Channel Header',
            'Edit Channel Purpose',
            'Rename Channel',
            'Convert to Private Channel',
            'Archive Channel',
            'Leave Channel',
        ];

        menuItems.forEach((item) => {
            // * Verify that the menu item is focused
            cy.uiGetChannelMenu().findByText(item).parent().should('be.focused');

            // # Press tab for next item
            cy.focused().tab();
        });

        // * Verify if menu is closed when we press Escape
        cy.get('body').typeWithForce('{esc}');
        cy.uiGetChannelMenu({exist: false});
    });

    it('MM-T1476 Accessibility Support in Team Menu Dropdown', () => {
        // # Open team menu
        cy.uiGetLHSHeader().click();

        // * Verify the accessibility support in the Main Menu Dropdown
        cy.findByRole('menu').
            should('exist').
            and('have.attr', 'aria-label', 'team menu').
            and('have.class', 'a11y__popup');

        // * Verify the first option is not selected by default
        cy.uiGetLHSTeamMenu().find('.MenuItem').
            children().eq(0).
            should('not.be.focused').
            focus();

        // * Verify the accessibility support in the Main Menu Dropdown items
        const menuItems = [
            {id: 'invitePeople', label: 'Invite People dialog'},
            {id: 'teamSettings', label: 'Team Settings dialog'},
            {id: 'manageMembers', label: 'Manage Members dialog'},
            {id: 'joinTeam', text: 'Join another team'},
            {id: 'leaveTeam', label: 'Leave Team dialog'},
            {id: 'createTeam', text: 'Create a team'},
        ];

        menuItems.forEach((item) => {
            // * Verify that the menu item is focused
            if (item.label) {
                cy.focused().should('have.attr', 'aria-label', item.label);
            } else {
                cy.focused().should('have.text', item.text);
            }

            // # Press tab for next item
            cy.focused().tab();
        });

        cy.uiGetLHSTeamMenu().find('.MenuItem').each((el) => {
            cy.wrap(el).should('have.attr', 'role', 'menuitem');
        });

        // * Verify if menu is closed when we press Escape
        cy.get('body').typeWithForce('{esc}');
        cy.uiGetLHSTeamMenu().should('not.exist');
    });

    it('MM-T1477 Accessibility Support in Status Dropdown  - KNOWN ISSUE: MM-45716', () => {
        // # Focus to set status button
        cy.uiGetSetStatusButton().focus().tab({shift: true}).tab();

        // * Verify the aria-label in status menu button
        cy.uiGetSetStatusButton().
            should('be.focused').
            click();

        // * Verify the accessibility support in the Status Dropdown
        cy.uiGetStatusMenuContainer().
            should('have.attr', 'aria-label', 'set status').
            and('have.class', 'a11y__popup').
            and('have.attr', 'role', 'menu');

        // * Verify the first option is not selected by default
        cy.uiGetStatusMenuContainer().find('.dropdown-menu').children().eq(0).should('not.be.focused');

        // # Press tab
        cy.focused().tab();

        // * Verify first focus is on menu header which is the profile image
        cy.uiGetStatusMenuContainer().within(() => {
            cy.findByAltText('user profile image').should('be.focused');
        });

        // # Press tab
        cy.focused().tab();

        // * Verify the accessibility support in the Status Dropdown menu items
        const menuItems = [
            {id: 'status-menu-custom-status', label: 'Set a Custom Status dialog'},
            {id: 'status-menu-online', label: 'online'},
            {id: 'status-menu-away', label: 'away'},
            {id: 'status-menu-dnd_menuitem', label: 'do not disturb. disables all notifications'},
            {id: 'status-menu-offline', label: 'offline'},
            {id: 'accountSettings', label: 'Profile dialog'},
            {id: 'logout', label: 'Log Out'},
        ];

        menuItems.forEach((item) => {
            // * Verify that the menu item is focused
            cy.uiGetStatusMenuContainer().find(`#${item.id}`).
                should('be.visible').
                findAllByLabelText(item.label).first().
                should('be.focused');

            // # Press tab for next item
            cy.focused().tab();
        });

        // * Verify if menu is closed when we press Escape
        cy.get('body').typeWithForce('{esc}');
        cy.uiGetStatusMenuContainer({exist: false});
    });
});
