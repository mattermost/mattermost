// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @mark_as_unread

import {beUnread} from '../../support/assertions';

import {markAsUnreadFromPost, verifyPostNextToNewMessageSeparator} from './helpers';

describe('Bot post unread message', () => {
    let newChannel;
    let botPost;
    let testTeam;

    before(() => {
        // # Create and visit new channel
        cy.apiInitSetup({
            promoteNewUserAsAdmin: true,
            loginAfter: true,
        }).then(({team, channel}) => {
            testTeam = team;
            newChannel = channel;
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
        });

        // # Create a bot and get userID
        cy.apiCreateBot().then(({bot}) => {
            const botUserId = bot.user_id;
            cy.apiPatchUserRoles(botUserId, ['system_user system_post_all system_admin']);

            // # Get token from bots id
            cy.apiAccessToken(botUserId, 'Create token').then(({token}) => {
                //# Add bot to team
                cy.apiAddUserToTeam(newChannel.team_id, botUserId);

                // # Post message as bot to the new channel
                cy.postBotMessage({token, channelId: newChannel.id, message: 'this is bot message'}).then((res) => {
                    botPost = res.data;
                });
            });
        });
    });

    it('MM-T252 bot post unread', () => {
        // # Mark the bot post as unread
        markAsUnreadFromPost(botPost);

        // * Verify the channel is unread in LHS
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.get(`#sidebarItem_${newChannel.name}`).should(beUnread).click();

        // * Verify the notification separator line exists and present before the unread message
        verifyPostNextToNewMessageSeparator('this is bot message');
    });
});
