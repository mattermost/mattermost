// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AxiosResponse} from 'axios';

import {ChainableT} from '../types';

/**
* postMessageAs is a task which is wrapped as command with post-verification
* that a message is successfully posted by the user/sender
* @param {Object} sender - a user object who will post a message
* @param {String} message - message in a post
* @param {Object} channelId - where a post will be posted
*/

interface PostMessageResp {
    id: string;
    status: number;
    data: any;
}

interface PostMessageArg {
    sender: {
        username: string;
        password: string;
    };
    message: string;
    channelId: string;
    rootId?: string;
    createAt?: number;
}

function postMessageAs(arg: PostMessageArg): ChainableT<PostMessageResp> {
    const {sender, message, channelId, rootId, createAt} = arg;
    const baseUrl = Cypress.config('baseUrl');

    return cy.task('postMessageAs', {sender, message, channelId, rootId, createAt, baseUrl}).then((response: AxiosResponse<{id: string}>) => {
        const {status, data} = response;
        expect(status).to.equal(201);

        // # Return the data so it can be interacted in a test
        return cy.wrap({id: data.id, status, data});
    });
}
Cypress.Commands.add('postMessageAs', postMessageAs);

/**
 * @param {string} [numberOfMessages = 30] - Number of messages
 * @param {Object} sender - a user object who will post a message
 * @param {String} message - message in a post
 * @param {Object} channelId - where a post will be posted
 */

function postListOfMessages({numberOfMessages = 30, ...rest}): ChainableT<any> {
    const baseUrl = Cypress.config('baseUrl');

    return (cy as any).
        task('postListOfMessages', {numberOfMessages, baseUrl, ...rest}, {timeout: numberOfMessages * 200}).
        each((message) => expect(message.status).to.equal(201));
}

Cypress.Commands.add('postListOfMessages', postListOfMessages);

/**
* reactToMessageAs is a task wrapped as command with post-verification
* that a reaction is added successfully to a message by a user/sender
* @param {Object} sender - a user object who will post a message
* @param {String} postId - post on which reaction is intended
* @param {String} reaction - emoji text eg. smile
*/
Cypress.Commands.add('reactToMessageAs', ({sender, postId, reaction}) => {
    const baseUrl = Cypress.config('baseUrl');

    return cy.task('reactToMessageAs', {sender, postId, reaction, baseUrl}).then(({status, data}) => {
        expect(status).to.equal(200);

        // # Return the response after reaction is added
        return cy.wrap({status, data});
    });
});

/**
* postIncomingWebhook is a task which is wrapped as command with post-verification
* that the incoming webhook is successfully posted
* @param {String} url - incoming webhook URL
* @param {Object} data - payload on incoming webhook
*/

function postIncomingWebhook({url, data, waitFor}: {
    url: string;
    data: Record<string, any>;
    waitFor?: string;
}): ChainableT {
    cy.task('postIncomingWebhook', {url, data}).its('status').should('be.equal', 200);

    if (!waitFor) {
        return;
    }

    cy.waitUntil(() => cy.getLastPost().then((el) => {
        switch (waitFor) {
        case 'text': {
            const textEl = el.find('.post-message__text > p')[0];
            return Boolean(textEl && textEl.textContent.includes(data.text));
        }
        case 'attachment-pretext': {
            const attachmentPretextEl = el.find('.attachment__thumb-pretext > p')[0];
            return Boolean(attachmentPretextEl && attachmentPretextEl.textContent.includes(data.attachments[0].pretext));
        }
        default:
            return false;
        }
    }));
}

Cypress.Commands.add('postIncomingWebhook', postIncomingWebhook);

interface ExternalRequestArg<T> {
    user: Record<string, unknown>;
    method: string;
    path: string;
    data?: T;
    failOnStatusCode?: boolean;
}
function externalRequest<T=any, U=any>(arg: ExternalRequestArg<U>): ChainableT<Pick<AxiosResponse<T>, 'data' | 'status'>> {
    const {user, method, path, data, failOnStatusCode = true} = arg;
    const baseUrl = Cypress.config('baseUrl');

    return cy.task('externalRequest', {baseUrl, user, method, path, data}).then((response: Pick<AxiosResponse<T & {id: string}>, 'data' | 'status'>) => {
        // Temporarily ignore error related to Cloud
        const cloudErrorId = [
            'ent.cloud.request_error',
            'api.cloud.get_subscription.error',
        ];

        if (response.data && !cloudErrorId.includes(response.data.id) && failOnStatusCode) {
            expect(response.status).to.be.oneOf([200, 201, 204]);
        }

        return cy.wrap(response);
    });
}
Cypress.Commands.add('externalRequest', externalRequest);

/**
* postMessageAs is a task which is wrapped as command with post-verification
* that a message is successfully posted by the bot
* @param {String} message - message in a post
* @param {Object} channelId - where a post will be posted
*/

function postBotMessage({token, message, props, channelId, rootId, createAt, failOnStatus = true}): ChainableT<PostMessageResp> {
    const baseUrl = Cypress.config('baseUrl');

    return cy.task('postBotMessage', {token, message, props, channelId, rootId, createAt, baseUrl}).then(({status, data}) => {
        if (failOnStatus) {
            expect(status).to.equal(201);
        }

        // # Return the data so it can be interacted in a test
        return cy.wrap({id: data.id, status, data});
    });
}

Cypress.Commands.add('postBotMessage', postBotMessage);

/**
* urlHealthCheck is a task wrapped as command that checks whether
* a URL is healthy and reachable.
* @param {String} name - name of service to check
* @param {String} url - URL to check
* @param {String} helperMessage - a message to display on error to help resolve the issue
* @param {String} method - a request using a specific method
* @param {String} httpStatus - expected HTTP status
*/

function urlHealthCheck({name, url, helperMessage, method, httpStatus}): ChainableT {
    Cypress.log({name, message: `Checking URL health at ${url}`});

    return cy.task('urlHealthCheck', {url, method}).then(({data, errorCode, status, success}) => {
        const urlService = `__${name}__ at ${url}`;

        const successMessage = success ?
            `${urlService}: reachable` :
            `${errorCode}: The test you're running requires ${urlService} to be reachable. \n${helperMessage}`;
        expect(success, successMessage).to.equal(true);

        const statusMessage = status === httpStatus ?
            `${urlService}: responded with ${status} HTTP status` :
            `${urlService}: expected to respond with ${httpStatus} but got ${status} HTTP status`;
        expect(status, statusMessage).to.equal(httpStatus);

        return cy.wrap({data, status});
    });
}

Cypress.Commands.add('urlHealthCheck', urlHealthCheck);

Cypress.Commands.add('requireWebhookServer', () => {
    const baseUrl = Cypress.config('baseUrl');
    const webhookBaseUrl = Cypress.env('webhookBaseUrl');
    const adminUsername = Cypress.env('adminUsername');
    const adminPassword = Cypress.env('adminPassword');
    const helperMessage = `
__Tips:__
    1. In local development, you may run "__npm run start:webhook__" at "/e2e" folder.
    2. If reachable from remote host, you may export it as env variable, like "__CYPRESS_webhookBaseUrl=[url] npm run cypress:open__".
`;

    cy.urlHealthCheck({
        name: 'Webhook Server',
        url: webhookBaseUrl,
        helperMessage,
        method: 'get',
        httpStatus: 200,
    });

    cy.task('postIncomingWebhook', {
        url: `${webhookBaseUrl}/setup`,
        data: {
            baseUrl,
            webhookBaseUrl,
            adminUsername,
            adminPassword,
        }}).
        its('status').should('be.equal', 201);
});

Cypress.Commands.overwrite('log', (subject, message) => cy.task('log', message));

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * externalRequest is a task which is wrapped as command with post-verification
             * that the external request is successfully completed
             * @param {Object} options
             * @param {<UserProfile, 'username' | 'password'>} options.user - a user initiating external request
             * @param {String} options.method - an HTTP method (e.g. get, post, etc)
             * @param {String} options.path - API path that is relative to Cypress.config().baseUrl
             * @param {Object} options.data - payload
             * @param {Boolean} options.failOnStatusCode - whether to fail on status code, default is true
             *
             * @example
             *    cy.externalRequest({user: sysadmin, method: 'POST', path: 'config', data});
             */
            externalRequest(options?: {
                user: Pick<UserProfile, 'username' | 'password'>;
                method: string;
                path: string;
                data?: Record<string, any>;
                failOnStatusCode?: boolean;
            }): Chainable<any>;

            /**
             * Adds a given reaction to a specific post from a user
             * @param {Object} reactToMessageObject - Information on person and post to which a reaction needs to be added
             * @param {Object} reactToMessageObject.sender - a user object who will post a message
             * @param {string} reactToMessageObject.postId  - post on which reaction is intended
             * @param {string} reactToMessageObject.reaction - emoji text eg. smile
             * @returns {Response} response: Cypress-chainable response
             *
             * @example
             *    cy.reactToMessageAs({sender:user2, postId:"ABC123", reaction: 'smile'});
             */
            reactToMessageAs({sender, postId, reaction}: {sender: Record<string, unknown>; postId: string; reaction: string}): Chainable<any>;

            /**
             * Verify that the webhook server is accessible, and then sets up base URLs and credential.
             *
             * @example
             *    cy.requireWebhookServer();
             */
            requireWebhookServer(): Chainable;

            postMessageAs: typeof postMessageAs;

            postListOfMessages: typeof postListOfMessages;

            postIncomingWebhook: typeof postIncomingWebhook;

            postBotMessage: typeof postBotMessage;

            urlHealthCheck: typeof urlHealthCheck;
        }
    }
}
