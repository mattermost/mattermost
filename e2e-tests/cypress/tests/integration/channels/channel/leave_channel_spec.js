// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Leave channel', () => {
    let testTeam;
    let testUser;
    let testChannel;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Login as test user and visit created channel
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiLogin(testUser);
            cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4429_1 Leave a channel while RHS is open', () => {
        // # Post a message in the channel
        cy.postMessage('Test leave channel while RHS open');
        cy.getLastPostId().then((id) => {
            // # Open RHS
            cy.clickPostCommentIcon(id);

            // # Post a reply message
            cy.postMessageAs({sender: testUser, message: 'another reply!', channelId: testChannel.id, rootId: id});

            // * RHS should be visible
            cy.get('#rhsContainer').should('be.visible');

            // * RHS text box should be visible
            cy.uiGetReplyTextBox();

            // # Archive the channel
            cy.uiLeaveChannel();
            cy.wait(TIMEOUTS.TWO_SEC); // eslint-disable-line cypress/no-unnecessary-waiting

            // * RHS should not be visible
            cy.get('#rhsContainer').should('not.exist');

            // * Assert that user is redirected to townsquare
            cy.url().should('include', '/channels/town-square');
            cy.get('#channelHeaderTitle').should('be.visible').and('contain', 'Town Square');
        });
    });

    it('MM-T4429_2 Leave a channel while RHS is open and CRT on', () => {
        // * Post text box should be visible
        cy.uiGetPostTextBox();

        // # Set CRT to on
        cy.uiChangeCRTDisplaySetting('ON');

        // # Post a message in the channel
        cy.postMessage('Test leave channel while RHS open');
        cy.getLastPostId().then((id) => {
            // # Open RHS
            cy.clickPostCommentIcon(id);

            // # Post a reply message
            cy.postMessageAs({sender: testUser, message: 'another reply!', channelId: testChannel.id, rootId: id});

            // * RHS should be visible
            cy.get('#rhsContainer').should('be.visible');

            // * RHS text box should be visible
            cy.uiGetReplyTextBox();

            // * Close tour tip
            cy.get('#tipNextButton').should('be.visible').click();

            // # Archive the channel
            cy.uiLeaveChannel();
            cy.wait(TIMEOUTS.TWO_SEC); // eslint-disable-line cypress/no-unnecessary-waiting

            // * RHS should not be visible
            cy.get('#rhsContainer').should('not.exist');

            // * Assert that user is redirected to townsquare
            cy.url().should('include', '/channels/town-square');
            cy.get('#channelHeaderTitle').should('be.visible').and('contain', 'Town Square');
        });
    });
});
