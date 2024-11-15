// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Channel', () => {
    let testTeam: Team;
    let ownChannel: Channel;
    let otherChannel: Channel;
    let testUser: UserProfile;
    let offTopicUrl: string;

    const myChannelsDividerText = 'My Channels';
    const otherChannelsDividerText = 'Other Channels';

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup().then(({team, channel, user, offTopicUrl: url}) => {
            testTeam = team;
            ownChannel = channel;
            testUser = user;
            offTopicUrl = url;

            cy.apiCreateChannel(testTeam.id, 'delta-test', 'Delta Channel').then((out) => {
                otherChannel = out.channel;
            });

            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
        });
    });

    it('Channel autocomplete should have both lists populated correctly', () => {
        // # Type "~"
        cy.uiGetPostTextBox().clear().type('~').wait(TIMEOUTS.HALF_SEC);
        cy.get('#loadingSpinner').should('not.exist');

        // * Should open up suggestion list for channels
        // * Should match each channel item
        cy.get('#suggestionList').should('be.visible').children().as('suggestionList');

        // * Should render "MY CHANNELS" suggestion list divider
        cy.get('@suggestionList').eq(0).contains(myChannelsDividerText, {matchCase: false});
        cy.get('@suggestionList').eq(1).should('contain', ownChannel.display_name);
        cy.get('@suggestionList').eq(2).should('contain', 'Off-Topic');
        cy.get('@suggestionList').eq(3).should('contain', 'Town Square');

        // * Should render "OTHER CHANNELS" suggestion list divider
        cy.get('@suggestionList').eq(4).contains(otherChannelsDividerText, {matchCase: false});
        cy.get('@suggestionList').eq(5).should('contain', otherChannel.display_name);
    });

    it('Joining a channel should alter channel mention autocomplete lists accordingly', () => {
        // # Join a channel by /join slash command
        cy.uiGetPostTextBox().clear().wait(TIMEOUTS.HALF_SEC).type(`/join ~${otherChannel.name}`).type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // * Verify that it redirects into the channel
        cy.url().should('include', `/${testTeam.name}/channels/${otherChannel.name}`);

        // # Type "~"
        cy.uiGetPostTextBox().type('~').wait(TIMEOUTS.HALF_SEC);
        cy.get('#loadingSpinner').should('not.exist');

        // * Should open up suggestion list for channels
        // * Should match each channel
        cy.get('#suggestionList').should('be.visible').children().as('suggestionList');

        // * Should render "MY CHANNELS" suggestion list divider
        cy.get('@suggestionList').eq(0).contains(myChannelsDividerText, {matchCase: false});
        cy.get('@suggestionList').eq(1).should('contain', ownChannel.display_name);
        cy.get('@suggestionList').eq(2).should('contain', otherChannel.display_name);
        cy.get('@suggestionList').eq(3).should('contain', 'Off-Topic');
        cy.get('@suggestionList').eq(4).should('contain', 'Town Square');
    });

    it('Getting removed from a channel should alter channel mention autocomplete lists accordingly', () => {
        // # Remove test user from the test channel
        cy.apiAdminLogin();
        cy.removeUserFromChannel(otherChannel.id, testUser.id).then((res) => {
            expect(res.status).to.equal(200);

            // # Login as test user and visit the test team
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Type "~"
            cy.uiGetPostTextBox().clear().type('~').wait(TIMEOUTS.HALF_SEC);
            cy.get('#loadingSpinner').should('not.exist');

            // * Should open up suggestion list for channels
            // * Should match each channel item
            cy.get('#suggestionList').should('be.visible').children().as('suggestionList');

            // * Should render "MY CHANNELS" suggestion list divider
            cy.get('@suggestionList').eq(0).contains(myChannelsDividerText, {matchCase: false});
            cy.get('@suggestionList').eq(1).should('contain', ownChannel.display_name);
            cy.get('@suggestionList').eq(2).should('contain', 'Off-Topic');
            cy.get('@suggestionList').eq(3).should('contain', 'Town Square');

            // * Should render "OTHER CHANNELS" suggestion list divider
            cy.get('@suggestionList').eq(4).contains(otherChannelsDividerText, {matchCase: false});
            cy.get('@suggestionList').eq(5).should('contain', otherChannel.display_name);
        });
    });
});
