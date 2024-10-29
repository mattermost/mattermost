// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {Bot} from '@mattermost/types/bots';
import {Team} from '@mattermost/types/teams';
import {createBotPatch} from '../../../support/api/bots';

describe('Bot channel intro and avatar', () => {
    let team: Team;
    let bot: Bot;

    before(() => {
        cy.apiInitSetup().then((out) => {
            team = out.team;
        });

        cy.makeClient().then(async (client) => {
            // # Create bot
            bot = await client.createBot(createBotPatch());
            await client.addToTeam(team.id, bot.user_id);
        });
    });

    it('MM-T1839 Bots have default profile image visible', () => {
        // # Open bot DM channel
        cy.visit(`/${team.name}/messages/@${bot.username}`);

        // # Get channel intro and bot-post Avatars
        cy.get<HTMLImageElement[]>(`#channelIntro .profile-icon > img.Avatar, img.Avatar[alt="${bot.username} profile image"]`).
            should(($imgs) => {
                // * Verify imgs downloaded
                expect($imgs[0].naturalWidth).to.be.greaterThan(0);
                expect($imgs[1].naturalWidth).to.be.greaterThan(0);
            }).
            each(($img) => {
                // * Verify img visible and has src
                cy.wrap($img).
                    should('be.visible').
                    and('have.attr', 'src').
                    then((url) => cy.request({url, encoding: 'binary'} as unknown as Partial<Cypress.RequestOptions>)).
                    then(({body}) => {
                        // * Verify matches expected default bot avatar
                        cy.fixture('bot-default-avatar.png', 'binary').should('deep.equal', body);
                    });
            });
    });
});
