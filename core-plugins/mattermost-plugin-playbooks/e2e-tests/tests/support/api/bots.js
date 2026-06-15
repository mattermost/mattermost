// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';

// *****************************************************************************
// Bots
// https://api.mattermost.com/#tag/bots
// *****************************************************************************

Cypress.Commands.add('apiCreateBot', ({prefix, bot = createBotPatch(prefix)} = {}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/bots',
        method: 'POST',
        body: bot,
    }).then((response) => {
        expect(response.status).to.equal(201);
        const {body} = response;
        return cy.wrap({
            bot: {
                ...body,
                fullDisplayName: `${body.display_name} (@${body.username})`,
            },
        });
    });
});

Cypress.Commands.add('apiGetBots', (page = 0, perPage = 200, includeDeleted = false) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/bots?page=${page}&per_page=${perPage}&include_deleted=${includeDeleted}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({bots: response.body});
    });
});

Cypress.Commands.add('apiDisableBot', (userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/bots/${userId}/disable`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

export function createBotPatch(prefix = 'bot') {
    const randomId = getRandomId();

    return {
        username: `${prefix}-${randomId}`,
        display_name: `Test Bot ${randomId}`,
        description: `Test bot description ${randomId}`,
    };
}

Cypress.Commands.add('apiDeactivateTestBots', () => {
    return cy.apiGetBots().then(({bots}) => {
        bots.forEach((bot) => {
            if (bot?.display_name?.includes('Test Bot') || bot?.username.startsWith('bot-')) {
                cy.apiDisableBot(bot.user_id);
                cy.apiDeactivateUser(bot.user_id);

                // Log for debugging
                cy.log(`Deactivated Bot: "${bot.username}"`);
            }
        });
    });
});
