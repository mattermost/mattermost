// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel_sidebar

import {getAdminAccount} from '../../../support/env';

describe('Channel switching', () => {
    const sysadmin = getAdminAccount();
    const cmdOrCtrl = Cypress.platform === 'darwin' ? '{cmd}' : '{ctrl}';

    let testTeam;
    let testChannel;

    beforeEach(() => {
        // # Start with a new team
        cy.apiAdminLogin();
        cy.apiInitSetup({
            loginAfter: true,
            channelPrefix: {name: 'c1', displayName: 'C1'},
        }).then(({team, channel, offTopicUrl}) => {
            testTeam = team;
            testChannel = channel;

            cy.visit(offTopicUrl);
        });
    });

    it('should switch channels when pressing the alt + arrow hotkeys', () => {
        // * Verify that we've switched to the new team
        cy.uiGetLHSHeader().findByText(testTeam.display_name);

        // # Post any message
        cy.postMessage('hello');

        // # Press alt + up
        cy.get('body').type('{alt}', {release: false}).type('{uparrow}').type('{alt}', {release: true});

        // * Verify that the channel changed to the test channel
        cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#channelHeaderTitle').should('contain', testChannel.display_name);

        // # Press alt + down
        cy.get('body').type('{alt}', {release: false}).type('{downarrow}').type('{alt}', {release: true});

        // * Verify that the channel changed to the off-topic
        cy.url().should('include', `/${testTeam.name}/channels/off-topic`);
        cy.get('#channelHeaderTitle').should('contain', 'Off-Topic');
    });

    it('should switch to unread channels when pressing the alt + shift + arrow hotkeys', () => {
        cy.apiCreateChannel(testTeam.id, 'c2', 'C2');

        // # Have another user post a message in the new channel
        cy.postMessageAs({sender: sysadmin, message: 'Test', channelId: testChannel.id});

        // * Verify that we've switched to the new team
        cy.uiGetLHSHeader().findByText(testTeam.display_name);

        // # Post any message
        cy.postMessage('hello');

        cy.getCurrentChannelId().as('offTopicId');

        // # Press alt + shift + up
        cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});

        // * Verify that the channel changed to Test Channel and skipped Off Topic
        cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#channelHeaderTitle').should('contain', testChannel.display_name);

        // # Have another user post a message in the town square
        cy.get('@offTopicId').then((offTopicId) => cy.postMessageAs({sender: sysadmin, message: 'Test', channelId: offTopicId.text()}));

        // # Press alt + shift + down
        cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});

        // * Verify that the channel changed back to 'Off-Topic' and skipped test channel 2
        cy.url().should('include', `/${testTeam.name}/channels/off-topic`);
        cy.get('#channelHeaderTitle').should('contain', 'Off-Topic');
    });

    it('should open and close channel switcher on ctrl/cmd + k', () => {
        // * Verify that the channel has loaded
        cy.get('#channelHeaderTitle').should('be.visible');

        // # Press ctrl/cmd + k
        cy.get('body').type(cmdOrCtrl, {release: false}).type('k').type(cmdOrCtrl, {release: true});

        // * Verify that the modal has been opened
        cy.get('.channel-switcher').should('be.visible');

        // # Press ctrl/cmd + k
        cy.get('body').type(cmdOrCtrl, {release: false}).type('k').type(cmdOrCtrl, {release: true});

        // * Verify that the modal has been closed
        cy.get('.channel-switcher').should('not.exist');
    });
});
