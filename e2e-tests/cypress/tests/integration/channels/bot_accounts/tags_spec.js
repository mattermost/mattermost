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
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Bot tags', () => {
    let me;
    let team;
    let channel;
    let postId;

    before(() => {
        cy.apiInitSetup().then((out) => {
            team = out.team;
            channel = out.channel;
        });

        let meId;

        cy.getCurrentUserId().then((id) => {
            meId = id;
        });

        cy.makeClient().then(async (client) => {
            // # Setup state
            me = await client.getUser(meId);
            const bot = await client.createBot(createBotPatch());
            await client.addToTeam(team.id, bot.user_id);
            await client.addToChannel(bot.user_id, channel.id);

            const {token} = await client.createUserAccessToken(bot.user_id, 'Create token');
            const message = `Message for @${me.username}. Signed, @${bot.username}.`;

            // # Post message as bot through api with auth token
            const props = {attachments: [{pretext: 'Some Pretext', text: 'Some Text'}]};

            cy.postBotMessage({token, message, props, channelId: channel.id}).then(async ({id}) => {
                postId = id;
                await client.pinPost(postId);

                cy.visit(`/${team.name}/channels/${channel.name}`);
                cy.get(`#post_${postId}`).trigger('mouseover', {force: true});
                cy.wait(TIMEOUTS.HALF_SEC).get(`#CENTER_flagIcon_${postId}`).click();
            });
        });
    });

    it('MM-T1831 BOT tag is visible in search results', () => {
        // # Open search
        cy.uiSearchPosts(`Message for @${me.username}`);

        // * Verify bot badge
        cy.get('.sidebar--right__title').should('contain.text', 'Search Results');
        rhsPostHasBotBadge(postId);
    });

    it('MM-T1832 BOT tag is visible in Recent Mentions', () => {
        // # Open mentions
        cy.uiGetRecentMentionButton().click();

        // * Verify bot badge
        cy.get('.sidebar--right__title').should('contain.text', 'Recent Mentions');
        rhsPostHasBotBadge(postId);
    });

    it('MM-T1833 BOT tag is visible in Pinned Posts', () => {
        // # Open pinned posts
        cy.uiGetChannelPinButton().click();

        // * Verify bot badge
        cy.get('.sidebar--right__title').should('contain.text', 'Pinned Posts');
        rhsPostHasBotBadge(postId);
    });

    it('MM-T3659 BOT tag is visible in Saved Posts', () => {
        // # Open saved posts
        cy.uiGetSavedPostButton().click();

        // * Verify bot badge
        cy.get('.sidebar--right__title').should('contain.text', 'Saved Posts');
        rhsPostHasBotBadge(postId);
    });
});

function rhsPostHasBotBadge(postId) {
    cy.get(`.post#searchResult_${postId} .Tag`).should('be.visible').and('have.text', 'BOT');
}
