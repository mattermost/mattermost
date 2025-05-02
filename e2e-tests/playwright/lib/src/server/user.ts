// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';

import {getRandomId} from '@/util';
import {testConfig} from '@/test_config';

export async function createNewUserProfile(client: Client4, prefix = 'user') {
    const randomUser = createRandomUser(prefix);

    const newUser = await client.createUser(randomUser, '', '');
    newUser.password = randomUser.password;

    return newUser;
}

export function createRandomUser(prefix = 'user') {
    const randomId = getRandomId();

    const user = {
        email: `${prefix}${randomId}@sample.mattermost.com`,
        username: `${prefix}${randomId}`,
        password: 'passwd',
        first_name: `First${randomId}`,
        last_name: `Last${randomId}`,
        nickname: `Nickname${randomId}`,
    };

    return user as UserProfile;
}

export function getDefaultAdminUser() {
    const admin = {
        username: testConfig.adminUsername,
        password: testConfig.adminPassword,
        first_name: 'Kenneth',
        last_name: 'Moreno',
        email: testConfig.adminEmail,
    };

    return admin as UserProfile;
}
