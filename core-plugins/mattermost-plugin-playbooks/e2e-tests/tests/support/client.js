// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAdminAccount} from './env';

import {E2EClient} from './client-impl';

const clients = {};

async function makeClient({user = getAdminAccount(), useCache = true} = {}) {
    const cacheKey = user.username + user.password;
    if (useCache && clients[cacheKey] != null) {
        return clients[cacheKey];
    }

    const client = new E2EClient();

    const baseUrl = Cypress.config('baseUrl');
    client.setUrl(baseUrl);

    await client.login(user.username, user.password);

    if (useCache) {
        clients[cacheKey] = client;
    }

    return client;
}

Cypress.Commands.add('makeClient', makeClient);
