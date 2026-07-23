// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';
import type {PartialExcept} from '@mattermost/types/utilities';

import {createRandomChannel} from './channel';
import {createNewUserProfile} from './user';

import {getFileFromAsset} from '@/file';

/**
 * Client4 extended with Playwright test-setup helpers only.
 * These are not part of the Mattermost server API — do not add real API wrappers here.
 */
export class PlaywrightClient4 extends Client4 {
    private createChannelOfType(
        teamId: string,
        displayName: string,
        type: ChannelType,
        name?: string,
    ): Promise<Channel> {
        return this.createChannel(
            createRandomChannel({
                teamId,
                name: name ?? displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                displayName,
                type,
                unique: true,
            }),
        );
    }

    async createPublicChannel(teamId: string, displayName = 'Public', name?: string): Promise<Channel> {
        return this.createChannelOfType(teamId, displayName, 'O', name);
    }

    async createPrivateChannel(teamId: string, displayName = 'Private', name?: string): Promise<Channel> {
        return this.createChannelOfType(teamId, displayName, 'P', name);
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

    /**
     * Creates a post with a default message and any number of files from the assets folder.
     */
    async createTestPost(override: PartialExcept<Post, 'channel_id'>, files: string[] = []) {
        const post = {
            message: 'test post',
            ...override,
        };

        if (!post.file_ids) {
            post.file_ids = await Promise.all(
                files.map((filename) => {
                    return new Promise<string>(async (resolve) => {
                        const formData = new FormData();
                        formData.set('channel_id', post.channel_id);
                        formData.set('files', getFileFromAsset(filename), filename);

                        const data = await this.uploadFile(formData);

                        resolve(data.file_infos[0].id);
                    });
                }),
            );
        }

        return this.createPost(post);
    }
}
