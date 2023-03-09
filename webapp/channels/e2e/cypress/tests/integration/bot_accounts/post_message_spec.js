// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @bot_accounts

describe('Bot post message', () => {
    let offTopicChannel;

    before(() => {
        cy.apiInitSetup().then(({team}) => {
            cy.apiGetChannelByName(team.name, 'off-topic').then(({channel}) => {
                offTopicChannel = channel;
            });
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T1812 Post as a bot when personal access tokens are false', () => {
        // # Create a bot and get bot user id
        cy.apiCreateBot().then(({bot}) => {
            const botUserId = bot.user_id;
            const message = 'This is a message from a bot.';

            // # Get token from bot's id
            cy.apiAccessToken(botUserId, 'Create token').then(({token}) => {
                //# Add bot to team
                cy.apiAddUserToTeam(offTopicChannel.team_id, botUserId);

                // # Post message as bot through api with auth token
                const props = {attachments: [{pretext: 'Some Pretext', text: 'Some Text'}]};
                cy.postBotMessage({token, message, props, channelId: offTopicChannel.id}).
                    its('id').
                    should('exist').
                    as('botPost');

                // * Verify bot message
                cy.uiWaitUntilMessagePostedIncludes(message);
                cy.get('@botPost').then((postId) => {
                    cy.get(`#postMessageText_${postId}`).
                        should('be.visible').
                        and('have.text', message);
                });
            });
        });
    });
});
