// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @bot_accounts

import {Bot} from '@mattermost/types/bots';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

describe('Bot display name', () => {
    let offTopicChannel: Channel;
    let otherSysadmin: UserProfile;

    before(() => {
        cy.intercept('**/api/v4/**').as('resources');

        // # Set ServiceSettings to expected values
        const newSettings = {
            ServiceSettings: {
                EnableUserAccessTokens: false,
            },
        };
        cy.apiUpdateConfig(newSettings);

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            otherSysadmin = sysadmin;
            cy.apiLogin(otherSysadmin);

            cy.apiInitSetup().then(({team}) => {
                cy.apiGetChannelByName(team.name, 'off-topic').then(({channel}) => {
                    offTopicChannel = channel;
                });
                cy.visit(`/${team.name}/channels/off-topic`);
                cy.wait('@resources');

                // # Wait for the page to fully load before continuing
                cy.get('#sidebar-header-container').should('be.visible').and('have.text', team.display_name);
            });
        });
    });

    it('MM-T1813 Display name for bots stays current', () => {
        cy.makeClient({user: otherSysadmin}).then((client) => {
            // # Create a bot and get bot user id
            cy.apiCreateBot().then(({bot}) => {
                const botUserId = bot.user_id;
                const firstMessage = 'This is the first message from a bot that will change its name';
                const secondMessage = 'This is the second message from a bot that has changed its name';

                // # Get token from bot's id
                cy.apiAccessToken(botUserId, 'Create token').then(({token}) => {
                    //# Add bot to team
                    cy.apiAddUserToTeam(offTopicChannel.team_id, botUserId);

                    // # Post message as bot through api with auth token
                    const props = {attachments: [{pretext: 'Some Pretext', text: 'Some Text'}]};
                    cy.postBotMessage({token, message: firstMessage, props, channelId: offTopicChannel.id}).
                        its('id').
                        should('exist').
                        as('botPost');
                    cy.uiWaitUntilMessagePostedIncludes(firstMessage);

                    // # Go to the channel
                    cy.get('#sidebarItem_off-topic').click({force: true});

                    // * Verify bot display name
                    cy.get('@botPost').then((postIdA) => {
                        cy.get(`#post_${postIdA} button.user-popover`).click();

                        cy.get('div.user-profile-popover').
                            should('be.visible');

                        cy.findByTestId(`popover-fullname-${bot.username}`).
                            should('have.text', bot.display_name);
                    }).then(() => {
                        // # Change display name after prior verification
                        cy.wrap(client.patchBot(bot.user_id, {display_name: `NEW ${bot.display_name}`})).then((newBot: Bot) => {
                            cy.postBotMessage({token, message: secondMessage, props, channelId: offTopicChannel.id}).
                                its('id').
                                should('exist').
                                as('newBotPost');
                            cy.uiWaitUntilMessagePostedIncludes(secondMessage);

                            // * Verify changed display name
                            cy.get('@newBotPost').then(() => {
                                cy.get('div.user-profile-popover').
                                    should('be.visible');

                                cy.findByTestId(`popover-fullname-${bot.username}`).
                                    should('have.text', newBot.display_name);
                            });
                        });
                    });
                });
            });
        });
    });
});
