// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from '../types';

const dbClient = Cypress.expose('dbClient');
const dbConnection = Cypress.expose('dbConnection');
const dbConfig = {
    client: dbClient,
    connection: dbConnection,
};

const message = `Compare "cypress.json" against "config.json" of mattermost-server. It should match database driver and connection string.

The value at "cypress.json" is based on default mattermost-server's local database: 
{"dbClient": "${dbClient}", "dbConnection": "${dbConnection}"}

If your server is using database other than the default, you may export those as env variables, like:
"__CYPRESS_dbClient=[dbClient] CYPRESS_dbConnection=[dbConnection] npm run cypress:open__"
`;

function apiRequireServerDBToMatch(): ChainableT {
    return cy.apiGetConfig().then(({config}) => {
        // On Cloud, SqlSettings is not being returned.
        // With that, checking of server DB will be ignored and will assume it does match with
        // the one being expected by Cypress.
        if (config.SqlSettings && config.SqlSettings.DriverName !== dbClient) {
            expect(config.SqlSettings.DriverName, message).to.equal(dbClient);
        }
    });
}
Cypress.Commands.add('apiRequireServerDBToMatch', apiRequireServerDBToMatch);

interface GetActiveUserSessionsParam {
    username: string;
    userId?: string;
    limit?: number;
}
interface GetActiveUserSessionsResult {
    user: Cypress.UserProfile;
    // DB session records have dynamic fields
    sessions: Array<Record<string, any>>;
}
function dbGetActiveUserSessions(params: GetActiveUserSessionsParam): ChainableT<GetActiveUserSessionsResult> {
    // cy.task() returns untyped data
    return cy.task('dbGetActiveUserSessions', {dbConfig, params}).then(({user, sessions, errorMessage}: any) => {
        expect(errorMessage).to.be.undefined;

        return cy.wrap({user, sessions});
    });
}
Cypress.Commands.add('dbGetActiveUserSessions', dbGetActiveUserSessions);

interface GetUserParam {
    username: string;
}
interface GetUserResult {
    user: Cypress.UserProfile & {mfasecret: string};
}
function dbGetUser(params: GetUserParam): ChainableT<GetUserResult> {
    // cy.task() returns untyped data
    return cy.task('dbGetUser', {dbConfig, params}).then(({user, errorMessage, error}: any) => {
        verifyError(error, errorMessage);

        return cy.wrap({user});
    });
}
Cypress.Commands.add('dbGetUser', dbGetUser);

interface GetUserSessionParam {
    sessionId: string;
}
interface GetUserSessionResult {
    // DB session records have dynamic fields
    session: Record<string, any>;
}
function dbGetUserSession(params: GetUserSessionParam): ChainableT<GetUserSessionResult> {
    // cy.task() returns untyped data
    return cy.task('dbGetUserSession', {dbConfig, params}).then(({session, errorMessage}: any) => {
        expect(errorMessage).to.be.undefined;

        return cy.wrap({session});
    });
}
Cypress.Commands.add('dbGetUserSession', dbGetUserSession);

interface UpdateUserSessionParam {
    sessionId: string;
    userId: string;
    // DB session fields are dynamic
    fieldsToUpdate: Record<string, any>;
}
interface UpdateUserSessionResult {
    // DB session records have dynamic fields
    session: Record<string, any>;
}
function dbUpdateUserSession(params: UpdateUserSessionParam): ChainableT<UpdateUserSessionResult> {
    // cy.task() returns untyped data
    return cy.task('dbUpdateUserSession', {dbConfig, params}).then(({session, errorMessage}: any) => {
        expect(errorMessage).to.be.undefined;

        return cy.wrap({session});
    });
}
Cypress.Commands.add('dbUpdateUserSession', dbUpdateUserSession);

function dbRefreshPostStats(): ChainableT<{success?: boolean; skipped?: boolean; message?: string}> {
    // cy.task() returns untyped data
    return cy.task('dbRefreshPostStats', {dbConfig}).then(({success, skipped, message, errorMessage, error}: any) => {
        verifyError(error, errorMessage);
        return cy.wrap({success, skipped, message} as {success?: boolean; skipped?: boolean; message?: string});
    }) as ChainableT<{success?: boolean; skipped?: boolean; message?: string}>;
}
Cypress.Commands.add('dbRefreshPostStats', dbRefreshPostStats);

function verifyError(error: unknown, errorMessage: string) {
    if (errorMessage) {
        expect(errorMessage, `${errorMessage}\n\n${message}\n\n${JSON.stringify(error)}`).to.be.undefined;
    }
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Gets server config, and assert if it matches with the database connection being used by Cypress
             *
             * @example
             *   cy.apiRequireServerDBToMatch();
             */
            apiRequireServerDBToMatch: typeof apiRequireServerDBToMatch;

            /**
             * Gets active sessions of a user on a given username or user ID directly from the database
             * @param {String} username
             * @param {String} userId
             * @param {String} limit - maximum number of active sessions to return, e.g. 50 (default)
             * @returns {Object} user - user object
             * @returns {[Object]} sessions - an array of active sessions
             */
            dbGetActiveUserSessions: typeof dbGetActiveUserSessions;

            /**
             * Gets user on a given username directly from the database
             * @param {Object} options
             * @param {String} options.username
             * @returns {UserProfile} user - user object
             */
            dbGetUser: typeof dbGetUser;

            /**
             * Gets session of a user on a given session ID directly from the database
             * @param {Object} options
             * @param {String} options.sessionId
             * @returns {Session} session
             */
            dbGetUserSession: typeof dbGetUserSession;

            /**
             * Updates session of a user on a given user ID and session ID with fields to update directly from the database
             * @param {Object} options
             * @param {String} options.sessionId
             * @param {String} options.userId
             * @param {Object} options.fieldsToUpdate - will update all except session ID and user ID
             * @returns {Session} session
             */
            dbUpdateUserSession: typeof dbUpdateUserSession;

            /**
             * Refreshes PostgreSQL materialized views for post statistics
             * @returns {Object} result
             * @returns {boolean} result.success - true if refresh was successful
             * @returns {boolean} result.skipped - true if operation was skipped (non-PostgreSQL)
             * @returns {string} result.message - message when operation is skipped
             */
            dbRefreshPostStats: typeof dbRefreshPostStats;
        }
    }
}
