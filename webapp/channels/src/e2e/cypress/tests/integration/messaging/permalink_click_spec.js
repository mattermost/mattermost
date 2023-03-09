// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

import {getAdminAccount} from '../../support/env';

describe('Permalink message edit', () => {
    let testTeam;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
        });
    });

    /**
     * 1. Should leave the team (if joined while trying to access private channel) if user decides not to join the private channel.
     * 2. Should show prompts when opened directly from address bar.
     * 3. Should show prompts without leaving the screen upon pressing on channel url/permalink.
     */
    it('MM-T3830 System admins prompted before joining private channel via permalink', () => {
        // # Go to test channel
        gotoChannel(testTeam, testChannel);

        // # Create Private Channel 1
        cy.uiCreateChannel({isPrivate: true}).then((channel1) => {
            // # Create Private Channel 2
            cy.uiCreateChannel({isPrivate: true}).then((channel2) => {
                // # Post a message
                cy.postMessage(Date.now().toString());

                cy.getLastPostId().then((postId) => {
                    // # Go to test channel
                    gotoChannel(testTeam, testChannel);

                    // # Post Private Channel 1 Permalink
                    const message1 = `${Cypress.config('baseUrl')}/${testTeam.name}/channels/${channel1.name}`;
                    cy.postMessage(message1);

                    // # Post Private Channel 2's POST Permalink
                    const message2 = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`;
                    cy.postMessage(message2);

                    // # Logout and login as sysadmin
                    cy.apiLogout().wait(TIMEOUTS.ONE_SEC).then(() => {
                        cy.apiLogin(getAdminAccount());

                        // # Leave private channel 1 & 2 to test the prompts
                        gotoChannel(testTeam, channel1);
                        cy.leaveTeam();

                        // # Go to channel 1 from url
                        cy.visit(`/${testTeam.name}/channels/${channel1.name}`);

                        // * Prompt should be shown upon going to the screen
                        verifyPrivateChannelJoinPromptIsVisible(channel1);

                        // # Cancel the prompt
                        cy.get('#cancelModalButton').should('be.visible').click();

                        // * Verify that we've left the team and switched to other team
                        cy.uiGetLHSHeader().findByText(testTeam.display_name);

                        // # Go to public channel
                        gotoChannel(testTeam, testChannel);

                        // # Click on link 1 - channel url
                        cy.get(`a[href="${message1}"]`).should('be.visible').click();

                        // * Prompt should be shown after the click
                        verifyPrivateChannelJoinPromptIsVisible(channel1);

                        // # Cancel the prompt
                        cy.get('#cancelModalButton').should('be.visible').click();

                        // * Verify we are still in the same channel
                        cy.get('#channelHeaderTitle').should('be.visible').should('contain', testChannel.display_name);

                        // # Click on link 2 - permalink
                        cy.get(`a[href="${message2}"]`).should('be.visible').click();

                        // * Prompt should be shown after the click for permalink as well
                        verifyPrivateChannelJoinPromptIsVisible(channel2);

                        // # Join channel 2
                        joinPrivateChannel(channel2);

                        // # Leave channel
                        cy.uiLeaveChannel(true);

                        // * Prompt should be shown even if we navigate back
                        cy.go('back').wait(TIMEOUTS.THREE_SEC);
                        verifyPrivateChannelJoinPromptIsVisible(channel2);
                    });
                });
            });
        });
    });
});

function gotoChannel(team, channel) {
    // # Visit town-square
    cy.visit(`/${team.name}/channels/${channel.name}`);
    cy.get('#channelHeaderTitle').should('be.visible').should('contain', channel.display_name || channel.name);
}

function joinPrivateChannel(channel) {
    // # Join the private channel
    cy.get('#confirmModalButton').should('be.visible').click();

    // * Verify private channel screen is open
    cy.get('#channelHeaderTitle').should('be.visible').should('contain', channel.name);
}

function verifyPrivateChannelJoinPromptIsVisible(channel) {
    // * Verify modal is shown before joining the private channel
    cy.get('#confirmModal').should('be.visible');
    cy.get('#confirmModalLabel').should('be.visible').and('have.text', 'Join private channel');
    cy.get('#confirmModalBody').should('be.visible').and('have.text', `You are about to join ${channel.name} without explicitly being added by the channel admin. Are you sure you wish to join this private channel?`);
}
