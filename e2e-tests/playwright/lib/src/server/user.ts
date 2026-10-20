// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserProfile, UserTimezone} from '@mattermost/types/users';
import {DateTime} from 'luxon';

import {getRandomId, newTestPassword} from '@/util';
import {testConfig} from '@/test_config';
import {REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY, REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY} from '@/constant';

export async function createNewUserProfile(
    client: Client4,
    options: {prefix?: string; disableTutorial?: boolean; disableOnboarding?: boolean} = {},
) {
    const {prefix = 'user', disableTutorial = true, disableOnboarding = true} = options;

    const randomUser = await createRandomUser(prefix);

    const newUser = await client.createUser(randomUser, '', '');
    // Set password to the created user profile so it can be used to login later
    newUser.password = randomUser.password;

    if (disableTutorial && disableOnboarding) {
        await setDefaultOnboardingPreferences(client, newUser.id);
        return newUser;
    }

    if (disableTutorial) {
        await client.savePreferences(newUser.id, [
            {user_id: newUser.id, category: 'tutorial_step', name: newUser.id, value: '999'},
            {user_id: newUser.id, category: 'crt_thread_pane_step', name: newUser.id, value: '999'},
        ]);
    }

    if (disableOnboarding) {
        await client.savePreferences(newUser.id, [
            {user_id: newUser.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
            {user_id: newUser.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
        ]);
    }

    return newUser;
}

/**
 * Marks the tutorial and first-time onboarding task list as already seen for the given
 * user, so they don't cover the UI on their first visit to a channel. Useful for users
 * that aren't created via createNewUserProfile, e.g. SSO-provisioned accounts.
 */
export async function setDefaultOnboardingPreferences(client: Client4, userId: UserProfile['id']) {
    await client.savePreferences(userId, [
        {user_id: userId, category: 'tutorial_step', name: userId, value: '999'},
        {user_id: userId, category: 'crt_thread_pane_step', name: userId, value: '999'},
        {user_id: userId, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: userId, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
    ]);
}

export async function createRandomUser(prefix = 'user') {
    const randomId = getRandomId();

    const user = {
        email: `${prefix}${randomId}@sample.mattermost.com`,
        username: `${prefix}${randomId}`,
        password: newTestPassword(),
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

export function isOutsideRemoteUserHour(userTz: UserTimezone | undefined) {
    const timezone = (userTz?.useAutomaticTimezone ? userTz?.automaticTimezone : userTz?.manualTimezone) || 'UTC';

    const teammateUserDate = DateTime.local().setZone(timezone);

    const currentHour = teammateUserDate.hour;
    return (
        currentHour >= REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY ||
        currentHour < REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY
    );
}
