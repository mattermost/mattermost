// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';
import type {PartialExcept} from '@mattermost/types/utilities';

import {createRandomChannel} from './channel';
import {loginOf, rememberLogin} from './credentials';
import {guardConfigPatch} from './patch_config';
import type {ConfigPatch, RestoreConfig} from './patch_config';
import {createNewUserProfile} from './user';

import {getFileFromAsset} from '@/file';

/**
 * One logged-in client per user and server, shared by `createPost({user_id})` and `postAs`. Module state, so it is
 * per Playwright worker. A failed login is dropped, so the next call logs in again instead of replaying the failure.
 */
const clientsByLogin = new Map<string, Promise<PlaywrightClient4>>();

/** A client logged in as `login` on the server at `url`, from the shared per-user cache. */
export function clientAs(url: string, login: {username: string; password: string}): Promise<PlaywrightClient4> {
    const key = [url, login.username, login.password].join('\n');
    let client = clientsByLogin.get(key);
    if (!client) {
        const other = new PlaywrightClient4();
        other.setUrl(url);
        const pending = other.login(login.username, login.password).then(() => other);
        pending.catch(() => {
            if (clientsByLogin.get(key) === pending) {
                clientsByLogin.delete(key);
            }
        });
        clientsByLogin.set(key, pending);
        client = pending;
    }
    return client;
}

/** Forgets every per-user client (after a server restart, see clearClientCache). */
export function clearUserClients() {
    clientsByLogin.clear();
}

/**
 * Client4 extended with Playwright test-setup helpers.
 * Prefer not adding general Mattermost API wrappers here — keep those on Client4 —
 * except for test-only compatibility shims needed against older server images.
 */
export class PlaywrightClient4 extends Client4 {
    // Captures Client4.patchConfig, login, createUser and createPost; must stay above the overrides.
    private readonly patchConfigRequest = (this as Client4).patchConfig;
    private readonly loginRequest = (this as Client4).login;
    private readonly createUserRequest = (this as Client4).createUser;
    private readonly createPostRequest = (this as Client4).createPost;

    private ownUserId = '';

    /** Client4.login that remembers who this client is, and the login for clients acting as that user. */
    login = async (loginId: string, password: string, token = '', ldapOnly = false) => {
        const profile = await this.loginRequest(loginId, password, token, ldapOnly);
        this.ownUserId = profile.id;
        rememberLogin(profile, password);
        return profile;
    };

    /** Client4.createUser that remembers the new user's login, so `createPost({user_id})` can post as them. */
    createUser = async (user: UserProfile, token: string, inviteId: string, redirect?: string) => {
        const profile = await this.createUserRequest(user, token, inviteId, redirect);
        if (user.password) {
            rememberLogin(profile, user.password);
        }
        return profile;
    };

    /**
     * Client4.createPost, as `user_id` when it names someone else: the server always makes the session's user the
     * author, so the post goes through that user's own client. That works for users this run created or logged in
     * as; for anyone else it throws rather than post as the wrong person. A backdated post (create_at) throws too:
     * only a system admin's create_at is kept.
     */
    createPost = async (post: Parameters<Client4['createPost']>[0]): Promise<Post> => {
        const author = post.user_id;
        if (!author || author === (await this.userIdOfSession())) {
            return this.createPostRequest(post);
        }
        if (post.create_at) {
            throw new Error(
                `createPost({user_id: '${author}', create_at}) can't backdate the post: it goes through that user's ` +
                    'own client, and the server only keeps create_at from a system admin. Post it as the admin.',
            );
        }
        const login = loginOf(author);
        if (!login) {
            throw new Error(
                `createPost({user_id: '${author}'}) can't post as that user: the server makes the logged-in user the ` +
                    "author, and this run doesn't know their password. Create them in the test, or post through " +
                    'their own client (pw.postAs(user, post)).',
            );
        }
        return (await clientAs(this.getUrl(), login)).createPost(post);
    };

    private async userIdOfSession() {
        if (!this.ownUserId) {
            this.ownUserId = (await this.getMe()).id;
        }
        return this.ownUserId;
    }

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
