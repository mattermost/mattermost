// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_settings
// node run_tests.js --group='@channel_settings'

import {ChannelType} from '@mattermost/types/channels';
import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Channel Settings', () => {
    let testTeam: Cypress.Team;
    let user1: Cypress.UserProfile;
    let admin: Cypress.UserProfile;

    before(() => {
        cy.apiGetMe().then(({user: adminUser}) => {
            admin = adminUser;

            cy.apiInitSetup().then(({team, user}) => {
                testTeam = team;
                user1 = user;

                cy.visit(`/${testTeam.name}/channels/town-square`);
            });
        });
    });

    it('MM-T1808 Hover effect exists to add a channel description / header (when not already present)', () => {
        // # Create a new public channel and then private channel
        ['O', 'P'].forEach((channelType) => {
            cy.apiCreateChannel(testTeam.id, `chan${getRandomId()}`, 'chan', channelType as ChannelType).then(({channel}) => {
                // # Go to new channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // * Test hovering over the header with public and private channel
                hoverOnChannelDescriptionAndVerifyBehavior();
            });
        });

        // # Create DM with admin and user 1
        cy.apiCreateDirectChannel([admin.id, user1.id]).then(() => {
            // # Go to DM
            cy.visit(`/${testTeam.name}/messages/@${user1.username}`);

            // * Test hovering over the header with DM
            hoverOnChannelDescriptionAndVerifyBehavior();
        });

        // # Create another user and add to the team
        cy.apiCreateUser().then(({user: user2}) => {
            cy.apiAddUserToTeam(testTeam.id, user2.id).then(() => {
                // # Create a GM with admin, user1 and user 2
                cy.apiCreateGroupChannel([user2.id, user1.id, admin.id]).then(({channel}) => {
                    // # Visit the channel using the name using the channels route
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                    // * Test hovering over the header with GM
                    hoverOnChannelDescriptionAndVerifyBehavior();
                });
            });
        });
    });
});

function hoverOnChannelDescriptionAndVerifyBehavior() {
    const channelDescriptionText = `test description ${getRandomId()}`;

    // # Wait a little for channel to load
    cy.wait(TIMEOUTS.ONE_SEC);

    // # Scan within channel header description area
    cy.get('#channelHeaderDescription').should('be.visible').find('span').invoke('show').click({multiple: true, force: true});

    // # Scan inside the channel header modal
    cy.get('.a11y__modal.modal-dialog').should('be.visible').within(() => {
        // # Enter a channel description
        cy.findByTestId('edit_textbox').should('exist').clear().type(channelDescriptionText);

        // # Click on save
        cy.findByText('Save').should('be.visible').click();
    });

    cy.get('#channelHeaderDescription').should('be.visible').within(() => {
        // * Verify that new channel header is set and click it
        cy.findAllByText(channelDescriptionText).should('be.visible').click({multiple: true, force: true});
    });

    // * Check clicking on it doesn't open the edit modal once again
    cy.get('.a11y__modal.modal-dialog').should('not.exist');
}
