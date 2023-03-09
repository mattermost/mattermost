// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Functions here are expected to work with MySQL and PostgreSQL (known as dialect).
 * When updating this file, make sure to test in both dialect.
 * You'll find table and columns names are being converted to lowercase. Reason being is that
 * in MySQL, first letter is capitalized.
 */

const mapKeys = require('lodash.mapkeys');

function convertKeysToLowercase(obj) {
    return mapKeys(obj, (_, k) => {
        return k.toLowerCase();
    });
}

function getKnexClient({client, connection}) {
    return require('knex')({client, connection}); // eslint-disable-line global-require
}

// Reuse DB client connection
let knexClient;

const dbGetActiveUserSessions = async ({dbConfig, params: {username, userId, limit}}) => {
    if (!knexClient) {
        knexClient = getKnexClient(dbConfig);
    }

    const maxLimit = 50;

    try {
        let user;
        if (username) {
            user = await knexClient(toLowerCase(dbConfig, 'Users')).where('username', username).first();
            user = convertKeysToLowercase(user);
        }

        const now = Date.now();
        const sessions = await knexClient(toLowerCase(dbConfig, 'Sessions')).
            where('userid', user ? user.id : userId).
            where('expiresat', '>', now).
            orderBy('lastactivityat', 'desc').
            limit(limit && limit <= maxLimit ? limit : maxLimit);

        return {
            user,
            sessions: sessions.map((session) => convertKeysToLowercase(session)),
        };
    } catch (error) {
        const errorMessage = 'Failed to get active user sessions from the database.';
        return {error, errorMessage};
    }
};

const dbGetUser = async ({dbConfig, params: {username}}) => {
    if (!knexClient) {
        knexClient = getKnexClient(dbConfig);
    }

    try {
        const user = await knexClient(toLowerCase(dbConfig, 'Users')).where('username', username).first();

        return {user: convertKeysToLowercase(user)};
    } catch (error) {
        const errorMessage = 'Failed to get a user from the database.';
        return {error, errorMessage};
    }
};

const dbGetUserSession = async ({dbConfig, params: {sessionId}}) => {
    if (!knexClient) {
        knexClient = getKnexClient(dbConfig);
    }

    try {
        const session = await knexClient(toLowerCase(dbConfig, 'Sessions')).
            where('id', '=', sessionId).
            first();

        return {session: convertKeysToLowercase(session)};
    } catch (error) {
        const errorMessage = 'Failed to get a user session from the database.';
        return {error, errorMessage};
    }
};

const dbUpdateUserSession = async ({dbConfig, params: {sessionId, userId, fieldsToUpdate = {}}}) => {
    if (!knexClient) {
        knexClient = getKnexClient(dbConfig);
    }

    try {
        let user = await knexClient(toLowerCase(dbConfig, 'Users')).where('id', userId).first();
        if (!user) {
            return {errorMessage: `No user found with id: ${userId}.`};
        }

        delete fieldsToUpdate.id;
        delete fieldsToUpdate.userid;

        user = convertKeysToLowercase(user);

        await knexClient(toLowerCase(dbConfig, 'Sessions')).
            where('id', '=', sessionId).
            where('userid', '=', user.id).
            update(fieldsToUpdate);

        const session = await knexClient(toLowerCase(dbConfig, 'Sessions')).
            where('id', '=', sessionId).
            where('userid', '=', user.id).
            first();

        return {session: convertKeysToLowercase(session)};
    } catch (error) {
        const errorMessage = 'Failed to update a user session from the database.';
        return {error, errorMessage};
    }
};

function toLowerCase(config, name) {
    if (config.client === 'mysql') {
        return name;
    }

    return name.toLowerCase();
}

module.exports = {
    dbGetActiveUserSessions,
    dbGetUser,
    dbGetUserSession,
    dbUpdateUserSession,
};
