// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @bot_accounts @mfa

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Bot accounts ownership and API', () => {
    let newTeam;
    let newUser;
    let newChannel;
    let botId;
    let botName;

    beforeEach(() => {
        cy.apiAdminLogin();

        // # Set ServiceSettings to expected values
        const newSettings = {
            ServiceSettings: {
                EnforceMultifactorAuthentication: false,
            },
        };
        cy.apiUpdateConfig(newSettings);

        cy.apiInitSetup().then(({team, user, channel, townSquareUrl}) => {
            newTeam = team;
            newUser = user;
            newChannel = channel;

            cy.visit(townSquareUrl);
            cy.postMessage('hello');
        });

        // # Create a test bot
        cy.apiCreateBot().then(({bot}) => {
            ({user_id: botId, display_name: botName} = bot);
            cy.apiPatchUserRoles(bot.user_id, ['system_admin', 'system_user']);
        });
    });

    it('MM-T1862 Only system admin are able to create bots', () => {
        // # Open product switch menu and click "Integrations"
        cy.uiOpenProductMenu('Integrations');

        // * Confirm integrations are visible
        cy.url().should('include', `/${newTeam.name}/integrations`);
        cy.get('.backstage-header').findByText('Integrations').should('be.visible');

        // # Login as a regular user
        cy.apiLogin(newUser);

        cy.visit(`/${newTeam.name}/channels/town-square`);

        // # Click product switch button
        cy.uiOpenProductMenu();

        // * Confirm "Integrations" is not visible
        cy.uiGetProductMenu().should('not.contain', 'Integrations');
    });

    it('MM-T1863 Only System Admin are able to create bots (API)', () => {
        // # Login as a regular user
        cy.apiLogin(newUser);

        // # Try to create a new bot as a regular user
        const botName3 = 'stay-enabled-bot-' + Date.now();

        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/api/v4/bots',
            method: 'POST',
            failOnStatusCode: false,
            body: {
                username: botName3,
                display_name: 'some text',
                description: 'some text',
            },
        }).then((response) => {
            // * Validate that request was denied
            expect(response.status).to.equal(403);
        });
    });

    it('MM-T1864 Create bot (API)', () => {
        // * This call will fail if bot was not created
        cy.apiCreateBot();
    });

    it('MM-T1865 Create post as bot', () => {
        // # Create token for the bot
        cy.apiCreateToken(botId).then(({token}) => {
            // # Logout to allow posting as bot
            cy.apiLogout();
            const msg1 = 'this is a bot message ' + botName;
            cy.apiCreatePost(newChannel.id, msg1, '', {attachments: [{pretext: 'Look some text', text: 'This is text'}]}, token);

            // # Re-login to validate post presence
            cy.apiAdminLogin();
            cy.visit(`/${newTeam.name}/channels/` + newChannel.name);

            // * Validate post was created
            cy.findByText(msg1).should('be.visible');
        });
    });

    it('MM-T1866 Create two posts in a row to the same channel', () => {
        // # Create token for the bot
        cy.apiCreateToken(botId).then(({token}) => {
            // # Logout to allow posting as bot
            cy.apiLogout();
            const msg1 = 'this is a bot message ' + botName;
            const msg2 = 'this is a bot message2 ' + botName;
            cy.apiCreatePost(newChannel.id, msg1, '', {attachments: [{pretext: 'Look some text', text: 'This is text'}]}, token).then(({body: post1}) => {
                cy.apiCreatePost(newChannel.id, msg2, '', {attachments: [{pretext: 'Look some text', text: 'This is text'}]}, token).then(({body: post2}) => {
                    // # Re-login to validate post presence
                    cy.apiAdminLogin();
                    cy.visit(`/${newTeam.name}/channels/` + newChannel.name);

                    // * Validate posts were created
                    cy.get(`#postMessageText_${post1.id}`, {timeout: TIMEOUTS.ONE_MIN}).should('contain', msg1);
                    cy.get(`#postMessageText_${post2.id}`, {timeout: TIMEOUTS.ONE_MIN}).should('contain', msg2);

                    // * Validate first post has an image
                    cy.get(`#post_${post1.id}`).find('.Avatar').should('be.visible');

                    // * Validate that the second one doesn't
                    cy.get(`#post_${post2.id}`).should('have.class', 'same--user');
                });
            });
        });
    });

    it('MM-T1867 Post as a bot and include an @ mention', () => {
        // # Create token for the bot
        cy.apiCreateToken(botId).then(({token}) => {
            // # Logout to allow posting as bot
            cy.apiLogout();
            const msg1 = 'this is a bot message ' + botName;
            cy.apiCreatePost(newChannel.id, msg1 + ' to @sysadmin', '', {}, token);

            // # Re-login to validate post presence
            cy.apiAdminLogin();
            cy.visit(`/${newTeam.name}/channels/` + newChannel.name);

            cy.getLastPostId().then((postId) => {
                // * Validate post was created
                cy.get(`#postMessageText_${postId}`, {timeout: TIMEOUTS.ONE_MIN}).should('contain', msg1);

                // * Assert that the last message posted contains highlighted mention
                cy.get(`#postMessageText_${postId}`, {timeout: TIMEOUTS.ONE_MIN}).find('.mention--highlight').should('be.visible');
            });
        });
    });

    it('MM-T1868 BOT has a member role and is not in target channel and team', () => {
        // # Create a test bot (member)
        cy.apiCreateBot().then(({bot}) => {
            // # Create token for the bot
            cy.apiCreateToken(bot.user_id).then(({token}) => {
                // # Logout to allow posting as bot
                cy.apiLogout();

                // # Try posting
                cy.apiCreatePost(newChannel.id, 'this is a bot message ' + bot.username, '', {}, token, false).then((response) => {
                    // * Validate that posting was not allowed
                    expect(response.status).to.equal(403);
                });
            });
        });
    });

    it('MM-T1869 BOT has a system admin role and is not in target channel and team', () => {
        const botName3 = 'stay-enabled-bot-' + Date.now();

        // # Create token for the bot
        cy.apiCreateToken(botId).then(({token}) => {
            // # Logout to allow posting as bot
            cy.apiLogout();

            // # Try posting
            cy.apiCreatePost(newChannel.id, 'this is a bot message ' + botName3, '', {}, token).then((response) => {
                // * Validate that posting was allowed
                expect(response.status).to.equal(201);
            });
        });
    });
});
