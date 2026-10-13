// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';
import type {PartialExcept} from '@mattermost/types/utilities';

import {createRandomChannel} from './channel';
import {guardConfigPatch} from './patch_config';
import type {ConfigPatch, RestoreConfig} from './patch_config';
import {createNewUserProfile} from './user';

import {getFileFromAsset} from '@/file';

/**
 * Client4 extended with Playwright test-setup helpers.
 * Prefer not adding general Mattermost API wrappers here — keep those on Client4 —
 * except for test-only compatibility shims needed against older server images.
 */
export class PlaywrightClient4 extends Client4 {
    // Captures Client4.patchConfig; must stay above the override.
    private readonly patchConfigRequest = (this as Client4).patchConfig;

    /** Client4.patchConfig that warns on lockout-capable settings and returns `restore` with the config. */
    patchConfig = async (patch: ConfigPatch): Promise<AdminConfig & {restore: RestoreConfig}> => {
        const restore = guardConfigPatch(this, patch);
        const config = await this.patchConfigRequest(patch);
        return Object.defineProperty(config, 'restore', {value: restore, enumerable: false}) as AdminConfig & {
            restore: RestoreConfig;
        };
    };

    /**
     * Same as Client4.getClientLicenseOld, but keeps `format=old` for older from-images
     * that still require it. Current servers ignore the parameter.
     */
    getClientLicenseOld = () => {
        return this.doFetch<ClientLicense>(`${this.getBaseRoute()}/license/client?format=old`, {method: 'get'});
    };

    /** Marks a user's email verified (admin only). */
    verifyUserEmailById = (userId: string) => {
        return this.doFetch<UserProfile>(`${this.getUserRoute(userId)}/email/verify/member`, {method: 'post'});
    };

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
                    return new Promise<string>((resolve) => {
                        const formData = new FormData();
                        formData.set('channel_id', post.channel_id);
                        formData.set('files', getFileFromAsset(filename), filename);

                        this.uploadFile(formData).then((data) => {
                            resolve(data.file_infos[0].id);
                        });
                    });
                }),
            );
        }

        return this.createPost(post);
    }
}
