// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Bot, BotPatch} from '@mattermost/types/bots';
import {getRandomId} from '../../utils';
import {ChainableT} from 'tests/types';

// *****************************************************************************
// Bots
// https://api.mattermost.com/#tag/bots
// *****************************************************************************

/**
 * Create a bot.
 * See https://api.mattermost.com/#tag/bots/paths/~1bots/post
 * @param {string} options.bot - predefined `bot` object instead of random bot
 * @param {string} options.prefix - 'bot' (default) or any prefix to easily identify a bot
 * @returns {Bot} out.bot: `Bot` object
 *
 * @example
 *   cy.apiCreateBot().then(({bot}) => {
 *       // do something with bot
 *   });
 */
function apiCreateBot({prefix, bot}: Partial<{prefix: string; bot: BotPatch}> = {}): ChainableT<{bot: Bot & {fullDisplayName: string}}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/bots',
        method: 'POST',
        body: bot || createBotPatch(prefix),
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
}

Cypress.Commands.add('apiCreateBot', apiCreateBot);

/**
 * Get bots.
 * See https://api.mattermost.com/#tag/bots/paths/~1bots/get
 * @param {number} options.page - The page to select
 * @param {number} options.perPage - The number of users per page. There is a maximum limit of 200 users per page
 * @param {boolean} options.includeDeleted - If deleted bots should be returned
 * @returns {Bot[]} out.bots: `Bot[]` object
 *
 * @example
 *   cy.apiGetBots();
 */
function apiGetBots(page = 0, perPage = 200, includeDeleted = false): ChainableT<{bots: Bot[]}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/bots?page=${page}&per_page=${perPage}&include_deleted=${includeDeleted}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({bots: response.body});
    });
}

Cypress.Commands.add('apiGetBots', apiGetBots);

/**
 * Disable bot.
 * See https://api.mattermost.com/#tag/bots/operation/DisableBot
 * @param {string} userId - User ID
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiDisableBot('user-id);
 */
function apiDisableBot(userId) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/bots/${userId}/disable`,
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiDisableBot', apiDisableBot);

/**
 * Patches bot
 * @param {string} prefix - bot prefix
 * @returns {BotPatch} botPatch: Cypress-chainable bot
*/
export function createBotPatch(prefix = 'bot'): BotPatch {
    const randomId = getRandomId();

    return {
        username: `${prefix}-${randomId}`,
        display_name: `Test Bot ${randomId}`,
        description: `Test bot description ${randomId}`,
    } as BotPatch;
}

/**
 * Deactivate test bots.
 *
 * @example
 *   cy.apiDeactivateTestBots();
 */
function apiDeactivateTestBots() {
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
}

Cypress.Commands.add('apiDeactivateTestBots', apiDeactivateTestBots);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            apiCreateBot: typeof apiCreateBot;
            apiDeactivateTestBots: typeof apiDeactivateTestBots;
            apiGetBots: typeof apiGetBots;
            apiDisableBot: typeof apiDisableBot;
        }
    }
}
