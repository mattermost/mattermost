// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {PlaywrightClient4} from './playwright_client';

import {testConfig} from '@/test_config';

// Variable to hold cache
const clients: Record<string, ClientCache> = {};

export async function makeClient(
    userRequest?: UserRequest,
    opts: {useCache?: boolean; skipLog?: boolean} = {useCache: true, skipLog: false},
): Promise<ClientCache> {
    const client = new PlaywrightClient4();
    client.setUrl(testConfig.baseURL);

    try {
        if (!userRequest) {
            return {client, user: null};
        }

        const cacheKey = userRequest.username + userRequest.password;
        if (opts?.useCache && clients[cacheKey] != null) {
            return clients[cacheKey];
        }

        const userProfile = await client.login(userRequest.username, userRequest.password);
        const user = {...userProfile, password: userRequest.password};

        if (opts?.useCache) {
            clients[cacheKey] = {client, user};
        }

        return {client, user};
    } catch (err) {
        if (!opts?.skipLog) {
            // log an error for debugging
            // eslint-disable-next-line no-console
            console.log('makeClient', err);
        }
        return {client, user: null};
    }
}

// Client types

type UserRequest = {
    username: string;
    email?: string;
    password: string;
};

type ClientCache = {
    client: PlaywrightClient4;
    user: UserProfile | null;
};
