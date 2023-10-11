// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {createBotPatch} from '../../../support/api/bots';
import {createChannelPatch} from '../../../support/api/channel';

describe('Managing bots in Teams and Channels', () => {
    let team;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: 'sample.mattermost.com',
            },
        });
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            team = out.team;
        });
    });

    it('MM-T1815 Add a BOT to a team that has email restricted', () => {
        cy.makeClient().then(async (client) => {
            // # Go to channel
            const channel = await client.getChannelByName(team.id, 'town-square');
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Invite bot to team
            const bot = await client.createBot(createBotPatch());
            cy.uiInviteMemberToCurrentTeam(bot.username);

            // * Verify system message in-channel
            cy.uiWaitUntilMessagePostedIncludes(`@${bot.username} added to the team by you.`);
        });
    });

    it('MM-T1816 Add a BOT to a channel', () => {
        cy.makeClient().then(async (client) => {
            // # Go to channel
            const channel = await client.createChannel(createChannelPatch(team.id, 'a-chan', 'A Channel'));
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Add bot to team
            const bot = await client.createBot(createBotPatch());
            await client.addToTeam(team.id, bot.user_id);

            // # Add bot to channel in team
            cy.uiAddUsersToCurrentChannel([bot.username]);

            // * Verify system message in-channel
            cy.uiWaitUntilMessagePostedIncludes(`@${bot.username} added to the channel by you.`);
        });
    });

    it('MM-T1817 Add a BOT to a channel that is not on the Team', () => {
        cy.makeClient().then(async (client) => {
            // # Go to channel
            const channel = await client.createChannel(createChannelPatch(team.id, 'a-chan', 'A Channel'));
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Invite bot to team
            const bot = await client.createBot(createBotPatch());
            cy.postMessage(`/invite @${bot.username} `);

            // * Verify system message in-channel
            cy.uiWaitUntilMessagePostedIncludes(`@${bot.username} is not a member of the team.`);
        });
    });

    it('MM-T1818 No ephemeral post about Adding a bot to a channel When Bot is mentioned', () => {
        cy.makeClient().then(async (client) => {
            // # Go to channel
            const channel = await client.createChannel(createChannelPatch(team.id, 'a-chan', 'A Channel'));
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # And bot to team
            const bot = await client.createBot(createBotPatch());
            cy.apiAddUserToTeam(team.id, bot.user_id);

            // # Mention bot
            const message = `hey @${bot.username}, tell me a rhyme..`;
            cy.postMessage(message);

            // * Verify no ephemeral post is shown asking if you want to invite the bot to the server
            cy.uiGetNthPost(-1).should('contain.text', message);
        });
    });
});
