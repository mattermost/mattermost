// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

function verifyNoChannelToJoinMessage(isVisible) {
    cy.findByText('No public channels').should(isVisible ? 'be.visible' : 'not.exist');
}

function ensureHideJoinedCheckboxEnabled(shouldBeChecked) {
    cy.get('#hideJoinedPreferenceCheckbox').then(($checkbox) => {
        cy.wrap($checkbox).findByText('Hide Joined').should('be.visible');
        cy.wrap($checkbox).find('div.get-app__checkbox').invoke('attr', 'class').then(($classList) => {
            if ($classList.split(' ').includes('checked') ^ shouldBeChecked) {
                // We click on the button only when the XOR operands do not match
                // e.g. checkbox is checked, but should not be checked; and vice-versa
                cy.wrap($checkbox).click();
                cy.wrap($checkbox).find('div.get-app__checkbox').should(`${shouldBeChecked ? '' : 'not.'}have.class`, 'checked');
            }
        });
    });
}

describe('browse public channels', () => {
    let testUser: UserProfile;
    let otherUser: UserProfile;
    let testTeam: Team;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });

            cy.apiLogin(testUser).then(() => {
                // # create 30 channels
                for (let i = 0; i < 30; i++) {
                    cy.apiCreateChannel(testTeam.id, 'public-channel', 'public-channel');
                }

                // # Go to town square
                cy.visit(`/${team.name}/channels/town-square`);
            });
        });
    });

    it('MM-T1664 Channels do not disappear from Browse Channels modal', () => {
        // # Login as other user
        cy.apiLogin(otherUser);

        // # Go to town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels');

        // * Assert that the browse channel modal is visible
        cy.findByRole('dialog', {name: 'Browse Channels'}).should('be.visible').then(() => {
            // # Click on dropdown
            cy.findByText('Channel Type: All').should('be.visible').click();

            // # Click archived channels
            cy.findByText('Public channels').should('be.visible').click();

            // # Click hide joined checkbox if not already checked
            ensureHideJoinedCheckboxEnabled(true);

            // * Assert that the moreChannelsList is visible and the number of channels is 31
            cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 31);

            // # scroll to the middle channel
            cy.get('#moreChannelsList .more-modal__row').eq(15).scrollIntoView();

            // * Assert that the "No more channels to join" message does not exist
            verifyNoChannelToJoinMessage(false);

            // # scroll to the last channel
            cy.get('#moreChannelsList .more-modal__row').last().scrollIntoView();

            // * Assert that the "No more channels to join" message does not exist
            verifyNoChannelToJoinMessage(false);

            // # scroll to the first channel
            cy.get('#moreChannelsList .more-modal__row').first().scrollIntoView();

            // * Assert that the "No more channels to join" message does not exist
            verifyNoChannelToJoinMessage(false);
        });

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Go to town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels');

        // * Assert the moreChannelsModel is visible
        cy.findByRole('dialog', {name: 'Browse Channels'}).should('be.visible').then(() => {
            // # Click on dropdown
            cy.findByText('Channel Type: All').should('be.visible').click();

            // # Click archived channels
            cy.findByText('Public channels').should('be.visible').click();

            // # Click hide joined checkbox if not already checked
            ensureHideJoinedCheckboxEnabled(true);

            // * Assert that the "No more channels to join" message is visible
            verifyNoChannelToJoinMessage(true);
        });
    });
});
