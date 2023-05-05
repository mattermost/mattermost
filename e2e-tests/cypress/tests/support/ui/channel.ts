// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from '../../types';

import {getRandomId} from '../../utils';
import * as TIMEOUTS from '../../fixtures/timeouts';

function dismissWorkTemplateTip() {
    const CLOSE_MODAL_ATTEMPTS = 5;
    const CLOSE_MODAL_WAIT_INTERVAL = 50;
    const SEL_DISMISS_TIP_ELEMENT = '[data-testid=work-templates-new-dismiss]';
    for (let i = 0; i < CLOSE_MODAL_ATTEMPTS; i += 1) {
        const found = Cypress.$(SEL_DISMISS_TIP_ELEMENT).length > 0;
        if (found) {
            cy.get(SEL_DISMISS_TIP_ELEMENT).should('be.visible').click();
            break;
        }
        cy.wait(CLOSE_MODAL_WAIT_INTERVAL);
    }
}
Cypress.Commands.add('dismissWorkTemplateTip', dismissWorkTemplateTip);

function dismissTourTip() {
    const CLOSE_MODAL_ATTEMPTS = 5;
    const CLOSE_MODAL_WAIT_INTERVAL = 50;
    const SEL_DISMISS_TIP_ELEMENT = '[data-testid=tour-tip-backdrop]';
    cy.wait(CLOSE_MODAL_WAIT_INTERVAL);
    for (let i = 0; i < CLOSE_MODAL_ATTEMPTS; i += 1) {
        const found = Cypress.$(SEL_DISMISS_TIP_ELEMENT).length > 0;
        if (found) {
            cy.get(SEL_DISMISS_TIP_ELEMENT).should('be.visible').click();
            break;
        }
        cy.wait(CLOSE_MODAL_WAIT_INTERVAL);
    }
}
Cypress.Commands.add('dismissTourTip', dismissTourTip);

interface CreateChannelOptions {
    prefix?: string;
    isPrivate?: boolean;
    purpose?: string;
    name?: string;
    createBoard?: boolean;
}

function uiCreateChannel({
    prefix = 'channel-',
    isPrivate = false,
    purpose = '',
    name = '',
    createBoard = false,
}: CreateChannelOptions): ChainableT<{name: string}> {
    cy.uiBrowseOrCreateChannel('Create new channel').click();
    cy.dismissWorkTemplateTip();

    cy.get('#work-template-modal').should('be.visible');
    if (isPrivate) {
        cy.get('#public-private-selector-button-P').click().wait(TIMEOUTS.HALF_SEC);
    } else {
        cy.get('#public-private-selector-button-O').click().wait(TIMEOUTS.HALF_SEC);
    }
    const channelName = name || `${prefix}${getRandomId()}`;
    cy.get('#input_new-channel-modal-name').should('be.visible').clear().type(channelName);
    if (purpose) {
        cy.get('#new-channel-modal-purpose').clear().type(purpose);
    }

    if (createBoard) {
        cy.get('#add-board-to-channel').should('be.visible');
        cy.findByTestId('add-board-to-channel-check').then((el) => {
            if (el && !el.hasClass('checked')) {
                el.click();
                cy.findByText('Select a template').should('be.visible').click();

                // Cypess sees this as animating, maybe because it is an item in react-select 2
                // so force the click even though it considers it animating
                cy.findByText('Company Goals & OKRs').should('be.visible').click({force: true});
            }
        });
    }
    cy.findByText('Create channel').click();
    cy.get('#work-template-modal').should('not.exist');
    cy.get('#channelIntro').should('be.visible');
    return cy.wrap({name: channelName});
}

Cypress.Commands.add('uiCreateChannel', uiCreateChannel);

function uiAddUsersToCurrentChannel(usernameList: string[]) {
    if (usernameList.length) {
        cy.get('#channelHeaderDropdownIcon').click();
        cy.get('#channelAddMembers').click();
        cy.get('#addUsersToChannelModal').should('be.visible');
        usernameList.forEach((username) => {
            cy.get('#selectItems input').typeWithForce(`@${username}{enter}`);
        });
        cy.get('#saveItems').click();
        cy.get('#addUsersToChannelModal').should('not.exist');
    }
}
Cypress.Commands.add('uiAddUsersToCurrentChannel', uiAddUsersToCurrentChannel);

function uiArchiveChannel(): ChainableT<JQuery> {
    cy.get('#channelHeaderDropdownIcon').click();
    cy.get('#channelArchiveChannel').click();
    return cy.get('#deleteChannelModalDeleteButton').click();
}
Cypress.Commands.add('uiArchiveChannel', uiArchiveChannel);

function uiUnarchiveChannel(): ChainableT<JQuery> {
    cy.get('#channelHeaderDropdownIcon').should('be.visible').click();
    cy.get('#channelUnarchiveChannel').should('be.visible').click();
    return cy.get('#unarchiveChannelModalDeleteButton').should('be.visible').click();
}
Cypress.Commands.add('uiUnarchiveChannel', uiUnarchiveChannel);

function uiLeaveChannel(isPrivate = false): ChainableT<JQuery> {
    cy.get('#channelHeaderDropdownIcon').click();

    if (isPrivate) {
        cy.get('#channelLeaveChannel').click();
        return cy.get('#confirmModalButton').click();
    }

    return cy.get('#channelLeaveChannel').click();
}
Cypress.Commands.add('uiLeaveChannel', uiLeaveChannel);

function goToDm(username: string): ChainableT<JQuery> {
    cy.uiAddDirectMessage().click({force: true});

    // # Start typing part of a username that matches previously created users
    cy.get('#selectItems input').typeWithForce(username);
    cy.findByRole('dialog', {name: 'Direct Messages'}).should('be.visible').wait(TIMEOUTS.ONE_SEC);
    cy.findByRole('textbox', {name: 'Search for people'}).
        typeWithForce(username).
        wait(TIMEOUTS.ONE_SEC).
        typeWithForce('{enter}');

    // # Save the selected item
    return cy.get('#saveItems').click().wait(TIMEOUTS.HALF_SEC);
}
Cypress.Commands.add('goToDm', goToDm);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `ui` prefix, e.g. `uiCreateChannel`.
// ***************************************************************

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            dismissWorkTemplateTip(): ChainableT<void>;

            dismissTourTip(): ChainableT<void>;

            /**
             * Create a new channel in the current team.
             * @param {string} options.prefix - Prefix for the name of the channel, it will be added a random string ot it.
             * @param {boolean} options.isPrivate - is the channel private or public (default)?
             * @param {string} options.purpose - Channel's purpose
             * @param {string} options.name - Channel's name
             * @param {boolean} options.createBoard) - Create a linked board. Defaults to false.
             *
             * @example
             *   cy.uiCreateChannel({prefix: 'private-channel-', isPrivate: true, name, createBoard: false});
             */
            uiCreateChannel: typeof uiCreateChannel;

            /**
             * Add users to the current channel.
             * @param {string[]} usernameList - list of userids to add to the channel
             *
             * @example
             *   cy.uiAddUsersToCurrentChannel(['user1', 'user2']);
             */
            uiAddUsersToCurrentChannel(usernameList: string[]): ChainableT<void>;

            /**
             * Archive the current channel.
             *
             * @example
             *   cy.uiArchiveChannel();
             */
            uiArchiveChannel: typeof uiArchiveChannel;

            /**
             * Unarchive the current channel.
             *
             * @example
             *   cy.uiUnarchiveChannel();
             */
            uiUnarchiveChannel: typeof uiUnarchiveChannel;

            /**
             * Leave the current channel.
             * @param {boolean} isPrivate - is the channel private or public (default)?
             *
             * @example
             *   cy.uiLeaveChannel(true);
             */
            uiLeaveChannel: typeof uiLeaveChannel;

            goToDm: typeof goToDm;
        }
    }
}
