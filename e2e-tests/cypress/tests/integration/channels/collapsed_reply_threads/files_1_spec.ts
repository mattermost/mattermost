// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads @not_cloud

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as MESSAGES from '../../../fixtures/messages';
import {matterpollPlugin} from '../../../utils/plugins';
import {interceptFileUpload} from '../files_and_attachments/helpers';

describe('Collapsed Reply Threads', () => {
    let testTeam: Team;
    let testChannel: Channel;
    let user1: UserProfile;

    before(() => {
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
            },
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Create new channel and other user, and add other user to channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel, user}) => {
            testTeam = team;
            user1 = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(user1.id, 'on');
        });
    });

    beforeEach(() => {
        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        interceptFileUpload();
    });

    it('MM-T4776 should display poll text without Markdown in the threads list', () => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Upload and enable "matterpoll" plugin
        cy.apiUploadAndEnablePlugin(matterpollPlugin);

        // # In center post the following: /poll "Do you like https://mattermost.com?"
        cy.postMessage('/poll "Do you like https://mattermost.com?"');

        cy.getLastPostId().then((pollId) => {
            // # Post a reply on the POLL to create a thread and follow
            cy.postMessageAs({sender: user1, message: MESSAGES.SMALL, channelId: testChannel.id, rootId: pollId});

            // # Click "Yes" or "No"
            cy.findByText('Yes').click();

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * Text in ThreadItem should say 'username: Do you like https://mattermost.com?'
            cy.get('.attachment__truncated').first().should('have.text', user1.nickname + ': Do you like https://mattermost.com?');

            // * Text in ThreadItem should say 'Total votes: 1'
            cy.get('.attachment__truncated').last().should('have.text', 'Total votes: 1');

            // # Open the thread
            cy.get('.ThreadItem').last().click();

            // # Go to channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # End the poll
            cy.findByText('End Poll').click();
            cy.findByText('End').click();

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * Text in ThreadItem should say 'username: Do you like https://mattermost.com?'
            cy.get('.attachment__truncated').first().should('have.text', user1.nickname + ': Do you like https://mattermost.com?');

            // * Text in ThreadItem should say 'This poll has ended. The results are:'
            cy.get('.attachment__truncated').last().should('have.text', 'This poll has ended. The results are:');

            // # Cleanup
            cy.apiDeletePost(pollId);
        });
    });
});
