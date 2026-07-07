// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {createRandomChannel} from './channel';
import {createNewUserProfile} from './user';

/**
 * Client4 extended with Playwright test-setup helpers only.
 * These are not part of the Mattermost server API — do not add real API wrappers here.
 */
export class PlaywrightClient4 extends Client4 {
    async createPublicChannel(teamId: string, displayName = 'Public', name?: string): Promise<Channel> {
        return this.createChannel(
            createRandomChannel({
                teamId,
                name: name ?? displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                displayName,
                unique: true,
            }),
        );
    }

    async createUsers(teamId: string, count: number, prefix = 'user'): Promise<UserProfile[]> {
        const users: UserProfile[] = [];
        for (let i = 0; i < count; i++) {
            const user = await createNewUserProfile(this, {prefix});
            await this.addToTeam(teamId, user.id);
            users.push(user);
        }
        return users;
    }
}
