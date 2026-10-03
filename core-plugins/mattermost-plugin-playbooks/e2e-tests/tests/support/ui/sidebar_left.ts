// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from '../../types';

Cypress.Commands.add('uiGetLHS', () => {
    return cy.get('#SidebarContainer').should('be.visible');
});

Cypress.Commands.add('uiGetLHSHeader', () => {
    return cy.uiGetLHS().
        find('.SidebarHeaderMenuWrapper').
        should('be.visible');
});

Cypress.Commands.add('uiOpenTeamMenu', (item = '') => {
    // # Click on LHS header
    cy.uiGetLHSHeader().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetLHSTeamMenu();
    }

    // # Click on a particular item
    return cy.uiGetLHSTeamMenu().
        findByText(item).
        scrollIntoView().
        should('be.visible').
        click();
});

Cypress.Commands.add('uiGetLHSAddChannelButton', () => {
    return cy.uiGetLHS().
        find('.AddChannelDropdown_dropdownButton');
});

Cypress.Commands.add('uiGetLHSTeamMenu', () => {
    return cy.uiGetLHS().find('#sidebarDropdownMenu');
});

function uiOpenSystemConsoleMenu(item = ''): ChainableT<JQuery> {
    // # Click on LHS header button
    cy.uiGetSystemConsoleButton().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetSystemConsoleMenu();
    }

    // # Click on a particular item
    return cy.uiGetSystemConsoleMenu().
        findByText(item).
        scrollIntoView().
        should('be.visible').
        click();
}

Cypress.Commands.add('uiOpenSystemConsoleMenu', uiOpenSystemConsoleMenu);

function uiGetSystemConsoleButton(): ChainableT<JQuery> {
    return cy.get('.admin-sidebar').
        findByRole('button', {name: 'Menu Icon'});
}

Cypress.Commands.add('uiGetSystemConsoleButton', uiGetSystemConsoleButton);

function uiGetSystemConsoleMenu(): ChainableT<JQuery> {
    return cy.get('.admin-sidebar').
        find('.dropdown-menu').
        should('be.visible');
}

Cypress.Commands.add('uiGetSystemConsoleMenu', uiGetSystemConsoleMenu);

Cypress.Commands.add('uiGetLhsSection', (section) => {
    if (section === 'UNREADS') {
        return cy.findByText(section).
            parent().
            parent().
            parent();
    }

    return cy.findAllByRole('button', {name: section}).
        first().
        parent().
        parent().
        parent();
});

Cypress.Commands.add('uiBrowseOrCreateChannel', (item) => {
    cy.get('.AddChannelDropdown_dropdownButton').
        should('be.visible').
        click();
    cy.get('.dropdown-menu').should('be.visible');

    if (item) {
        cy.findByRole('menuitem', {name: item});
    }
});

Cypress.Commands.add('uiAddDirectMessage', () => {
    return cy.findByRole('button', {name: 'Write a direct message'});
});

Cypress.Commands.add('uiGetFindChannels', () => {
    return cy.get('#lhsNavigator').findByRole('button', {name: 'Find Channels'});
});

Cypress.Commands.add('uiOpenFindChannels', () => {
    cy.uiGetFindChannels().click();
});

function uiGetSidebarThreadsButton(): ChainableT<JQuery> {
    return cy.get('#sidebar-threads-button').should('be.visible');
}
Cypress.Commands.add('uiGetSidebarThreadsButton', uiGetSidebarThreadsButton);

Cypress.Commands.add('uiGetChannelSidebarMenu', (channelName, isChannelId = false) => {
    cy.uiGetLHS().within(() => {
        if (isChannelId) {
            cy.get(`#sidebarItem_${channelName}`).should('be.visible').find('button').should('exist').click({force: true});
        } else {
            cy.findByText(channelName).should('be.visible').parents('a').find('button').should('exist').click({force: true});
        }
    });

    return cy.findByRole('menu', {name: 'Edit channel menu'}).should('be.visible');
});

Cypress.Commands.add('uiClickSidebarItem', (name) => {
    cy.uiGetSidebarItem(name).click({force: true});

    if (name === 'threads') {
        cy.get('body').then((body) => {
            if (body.find('#genericModalLabel').length > 0) {
                cy.uiCloseModal('A new way to view and follow threads');
            }
        });
        cy.findByRole('heading', {name: 'Followed threads'});
    } else {
        cy.findAllByTestId('postView').should('be.visible');
    }
});

Cypress.Commands.add('uiGetSidebarItem', (channelName) => {
    return cy.get(`#sidebarItem_${channelName}`);
});

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Get LHS
             *
             * @example
             *   cy.uiGetLHS();
             */
            uiGetLHS(): Chainable;

            /**
             * Get LHS header
             *
             * @example
             *   cy.uiGetLHSHeader().click();
             */
            uiGetLHSHeader(): Chainable;

            /**
             * Open team menu
             *
             * @param {string} item - ex. 'Invite People', 'Team Settings', etc.
             *
             * @example
             *   cy.uiOpenTeamMenu();
             */
            uiOpenTeamMenu(item?: string): Chainable;

            /**
             * Get LHS add channel button
             *
             * @example
             *   cy.uiGetLHSAddChannelButton().click();
             */
            uiGetLHSAddChannelButton(): Chainable;

            /**
             * Get LHS team menu
             *
             * @example
             *   cy.uiGetLHSTeamMenu().should('not.exist);
             */
            uiGetLHSTeamMenu(): Chainable;

            /**
             * Get LHS section
             * @param {string} section - section such as UNREADS, CHANNELS, FAVORITES, DIRECT MESSAGES and other custom category
             *
             * @example
             *   cy.uiGetLhsSection('CHANNELS');
             */
            uiGetLhsSection(section: string): Chainable;

            /**
             * Open menu to browse or create channel
             * @param {string} item - dropdown menu. If set, it will do click action.
             *
             * @example
             *   cy.uiBrowseOrCreateChannel('Browse channels');
             */
            uiBrowseOrCreateChannel(item: string): Chainable;

            /**
             * Get "+" button to write a direct message
             * @example
             *   cy.uiAddDirectMessage();
             */
            uiAddDirectMessage(): Chainable;

            /**
             * Get find channels button
             * @example
             *   cy.uiGetFindChannels();
             */
            uiGetFindChannels(): Chainable;

            /**
             * Open find channels
             * @example
             *   cy.uiOpenFindChannels();
             */
            uiOpenFindChannels(): Chainable;

            /**
             * Open menu of a channel in the sidebar
             * @param {string} channelName - name of channel, ex. 'town-square'
             * @param {boolean} isChannelId - default false. If true, it will use channel id instead of channel name
             * @example
             *   cy.uiGetChannelSidebarMenu('Town Square');
             *   cy.uiGetChannelSidebarMenu('user1212__user333', true);
             */
            uiGetChannelSidebarMenu(channelName: string, isChannelId?: boolean): Chainable;

            /**
             * Click sidebar item by channel or thread name
             * @param {string} name - channel name for channels, and threads for Global Threads
             *
             * @example
             *   cy.uiClickSidebarItem('town-square');
             */
            uiClickSidebarItem(name: string): Chainable;

            /**
             * Get sidebar item by channel or thread name
             * @param {string} name - channel name for channels, and threads for Global Threads
             *
             * @example
             *   cy.uiGetSidebarItem('town-square').find('.badge').should('be.visible');
             */
            uiGetSidebarItem(name: string): Chainable;

            uiOpenSystemConsoleMenu: typeof uiOpenSystemConsoleMenu;

            uiGetSystemConsoleButton: typeof uiGetSystemConsoleButton;

            uiGetSystemConsoleMenu: typeof uiGetSystemConsoleMenu;

            uiGetSidebarThreadsButton: typeof uiGetSidebarThreadsButton;
        }
    }
}
