// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Keyboard Shortcuts', () => {
    let sysadmin;
    let dmWithSysadmin;
    let townSquare;
    let offTopic;
    let testTeam;
    let publicChannel;
    let privateChannel;

    before(() => {
        cy.apiGetMe().then(({user: adminUser}) => {
            sysadmin = adminUser;

            // # Create and login as new user
            // # Create a test team and channel, then visit
            cy.apiInitSetup({loginAfter: true}).then(({team, channel, user}) => {
                testTeam = team;
                publicChannel = channel;

                cy.apiCreateChannel(testTeam.id, 'private-a', 'Private B', 'P').then((out) => {
                    privateChannel = out.channel;
                });
                cy.apiCreateDirectChannel([sysadmin.id, user.id]).then((out) => {
                    dmWithSysadmin = out.channel;
                    dmWithSysadmin.name = sysadmin.username;
                    dmWithSysadmin.display_name = sysadmin.username;
                });
                cy.apiGetChannelByName(testTeam.name, 'town-square').then((out) => {
                    townSquare = out.channel;
                });
                cy.apiGetChannelByName(testTeam.name, 'off-topic').then((out) => {
                    offTopic = out.channel;
                });
            });
        });
    });

    it('MM-T1229 Alt/Option + Up', () => {
        cy.visit(`/${testTeam.name}/messages/@${sysadmin.username}`);

        // * Verify that the channel is loaded
        cy.get('#channelHeaderTitle').should('contain', sysadmin.username).wait(TIMEOUTS.ONE_SEC);

        // * Switch to channels by Alt+Up/Down keypress and verify
        verifyChannelSwitch(testTeam.name, townSquare, dmWithSysadmin, '{uparrow}');
        verifyChannelSwitch(testTeam.name, privateChannel, townSquare, '{uparrow}');
        verifyChannelSwitch(testTeam.name, offTopic, privateChannel, '{uparrow}');
        verifyChannelSwitch(testTeam.name, publicChannel, offTopic, '{uparrow}');

        // * Should switch to bottom of channel list when current channel is at the very top
        verifyChannelSwitch(testTeam.name, dmWithSysadmin, publicChannel, '{uparrow}');
    });

    it('MM-T1230 Alt/Option + Down', () => {
        cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);

        // * Verify that the channel is loaded
        cy.get('#channelHeaderTitle').should('contain', publicChannel.display_name).wait(TIMEOUTS.ONE_SEC);

        // # Switch to channels by Alt+Up/Down keypress and verify
        verifyChannelSwitch(testTeam.name, offTopic, publicChannel, '{downarrow}');
        verifyChannelSwitch(testTeam.name, privateChannel, offTopic, '{downarrow}');
        verifyChannelSwitch(testTeam.name, townSquare, privateChannel, '{downarrow}');
        verifyChannelSwitch(testTeam.name, dmWithSysadmin, townSquare, '{downarrow}');
    });

    function verifyChannelSwitch(teamName, toChannel, fromChannel, arrowKey) {
        // # Type Alt+Up/Down
        cy.get('body').type(`{alt}${arrowKey}`);

        // * Verify that it redirects into expected URL
        if (toChannel.type === 'D') {
            cy.url().should('include', `/${teamName}/messages/@${toChannel.name}`);
        } else {
            cy.url().should('include', `/${teamName}/channels/${toChannel.name}`);
        }

        cy.get('#SidebarContainer').should('be.visible').within(() => {
            // * Verify that the toChannel is active in LHS
            verifyClass(toChannel, 'have.class');

            // * Verify that the fromChannel is not active in LHS
            verifyClass(fromChannel, 'not.have.class');
        });

        function verifyClass(channel, assertion) {
            if (channel.type) {
                let label;
                if (channel.type === 'O') {
                    label = channel.display_name.toLowerCase() + ' public channel';
                } else if (channel.type === 'P') {
                    label = channel.display_name.toLowerCase() + ' private channel';
                } else if (channel.type === 'D') {
                    label = channel.display_name.toLowerCase();
                }

                cy.findByLabelText(label).parent().should(assertion, 'active');
            } else {
                // For Insights
                cy.findByText(channel.name).parent().parent().parent().should(assertion, 'active');
            }
        }
    }
});

