// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {AdminConfig} from '@mattermost/types/config';
import {UserProfile} from '@mattermost/types/users';

import {testConfig} from '@/test_config';

// Extend Client4 with methods used for testing
declare module '@mattermost/client' {
    interface Client4 {
        updateConfigX: (config: Partial<AdminConfig>) => Promise<AdminConfig>;
    }
}

// updateConfigX merges the given config with the current config and updates it to the server
Client4.prototype.updateConfigX = async function (this: Client4, config: Partial<AdminConfig>) {
    const currentConfig = await this.getConfig();
    const newConfig = {...currentConfig, ...config};
    return await this.updateConfig(newConfig);
};

// Variable to hold cache
const clients: Record<string, ClientCache> = {};

export async function makeClient(
    userRequest?: UserRequest,
    opts: {useCache?: boolean; skipLog?: boolean} = {useCache: true, skipLog: false},
): Promise<ClientCache> {
    const client = new Client4();
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
    client: Client4;
    user: UserProfile | null;
};
