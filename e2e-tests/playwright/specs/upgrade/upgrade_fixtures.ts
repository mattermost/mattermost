// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Fixed actor names shared across separate upgrade-from and upgrade-to processes.

import fs from 'node:fs';
import path from 'node:path';

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';
import type {APIRequestContext} from '@playwright/test';

import {expect, getFileData, getFileFromAsset, getPluginStatus} from '@mattermost/playwright-lib';

const BASELINE_PATH = path.resolve(process.cwd(), '.upgrade_baseline.json');

export const UPGRADE_TEAM_NAME = 'upgrade-test';
export const UPGRADE_PUBLIC_CHANNEL_NAME = 'upgrade-public';
export const UPGRADE_PRIVATE_CHANNEL_NAME = 'upgrade-private';

export const UPGRADE_USER: UserProfile = {
    username: 'upgradetestuser',
    email: 'upgradetestuser@sample.mattermost.com',
    password: 'Upgradetestuser123!',
    first_name: 'Upgrade',
    last_name: 'User',
} as UserProfile;

export const UPGRADE_PEER_USERS: UserProfile[] = [
    {username: 'upgradetestpeer1', email: 'upgradetestpeer1@sample.mattermost.com', password: 'Upgradetestpeer123!'},
    {username: 'upgradetestpeer2', email: 'upgradetestpeer2@sample.mattermost.com', password: 'Upgradetestpeer123!'},
    {username: 'upgradetestpeer3', email: 'upgradetestpeer3@sample.mattermost.com', password: 'Upgradetestpeer123!'},
].map((u) => u as UserProfile);

export const UPGRADE_PUBLIC_MESSAGE = 'upgrade-check public channel message';
export const UPGRADE_PRIVATE_MESSAGE = 'upgrade-check private channel message';
export const UPGRADE_DM_MESSAGE = 'upgrade-check direct message';
export const UPGRADE_GM_MESSAGE = 'upgrade-check group message';
export const UPGRADE_SEARCH_MESSAGE = 'upgrade-check searchable-marker-abc123';
export const UPGRADE_ATTACHMENT_FILE = 'small-image.png';
export const UPGRADE_PROFILE_PHOTO_FILE = 'mattermost-icon_128x128.png';
export const UPGRADE_MINIO_ATTACHMENT_FILE = 'mattermost.png';
export const UPGRADE_AZURITE_ATTACHMENT_FILE = 'image-400x40.jpg';

export const UPGRADE_ADMIN_PUBLIC_MESSAGE = 'upgrade-check admin public channel message';
export const UPGRADE_ADMIN_PRIVATE_MESSAGE = 'upgrade-check admin private channel message';
export const UPGRADE_ADMIN_DM_MESSAGE = 'upgrade-check admin direct message';
export const UPGRADE_ADMIN_GM_MESSAGE = 'upgrade-check admin group message';
export const UPGRADE_ADMIN_SEARCH_MESSAGE = 'upgrade-check admin-searchable-marker-xyz789';
export const UPGRADE_ADMIN_ATTACHMENT_MESSAGE = 'upgrade-check admin attachment message';
export const UPGRADE_ADMIN_AVATAR_MESSAGE = 'upgrade-check admin avatar message';

export const UPGRADE_PLUGIN_ID = 'com.mattermost.demo-plugin';
export const UPGRADE_PLUGIN_BUNDLE_URL =
    'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz';
export const UPGRADE_PLUGIN_BUNDLE_PATH = path.resolve(process.cwd(), '.upgrade_plugin_bundle.tar.gz');

/** Looks up the shared upgrade-test team, creating it on first (from-phase) run. */
export async function ensureUpgradeTeam(adminClient: Client4) {
    try {
        return await adminClient.getTeamByName(UPGRADE_TEAM_NAME);
    } catch {
        return adminClient.createTeam({
            name: UPGRADE_TEAM_NAME,
            display_name: 'Upgrade Test',
            type: 'O',
        } as any);
    }
}

/** Looks up a shared upgrade-test user by username, creating (and adding to the team) if new. */
export async function ensureUpgradeUser(adminClient: Client4, teamId: string, spec: UserProfile) {
    let user: UserProfile;
    try {
        const existing = await adminClient.getUserByUsername(spec.username);
        user = {...existing, password: spec.password} as UserProfile;
    } catch {
        const created = await adminClient.createUser(spec, '', '');
        await adminClient.addToTeam(teamId, created.id);
        user = {...created, password: spec.password} as UserProfile;
    }

    await adminClient.savePreferences(user.id, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
    ]);

    return user;
}

/** Looks up a shared upgrade-test channel by name, creating it under the team if new. */
export async function ensureUpgradeChannel(adminClient: Client4, teamId: string, name: string, type: 'O' | 'P') {
    try {
        return await adminClient.getChannelByName(teamId, name);
    } catch {
        return adminClient.createChannel({
            team_id: teamId,
            name,
            display_name: name,
            type,
        } as any);
    }
}

/** Creates or returns an existing DM between the two users. */
export async function ensureDirectChannel(client: Client4, userId: string, peerUserId: string): Promise<Channel> {
    return client.createDirectChannel([userId, peerUserId]);
}

/** Creates or returns an existing GM among the given users (includes the acting user). */
export async function ensureGroupChannel(client: Client4, userIds: string[]): Promise<Channel> {
    return client.createGroupChannel(userIds);
}

/** Creates a text post in the given channel. */
export async function postMessage(client: Client4, channelId: string, message: string, rootId?: string): Promise<Post> {
    return client.createPost({
        channel_id: channelId,
        message,
        ...(rootId ? {root_id: rootId} : {}),
    });
}

/** Uploads an asset file and creates a post that attaches it. */
export async function postWithAttachment(
    client: Client4,
    channelId: string,
    message: string,
    fileName: string,
): Promise<Post> {
    const formData = new FormData();
    formData.set('channel_id', channelId);
    formData.set('files', getFileFromAsset(fileName), fileName);
    const uploaded = await client.uploadFile(formData);
    const fileId = uploaded.file_infos[0].id;

    return client.createPost({
        channel_id: channelId,
        message,
        file_ids: [fileId],
    });
}

/** Asserts a channel's recent posts include the given message text. */
export async function assertChannelContainsMessage(client: Client4, channelId: string, message: string): Promise<void> {
    const postList = await client.getPosts(channelId, 0, 60);
    const found = Object.values(postList.posts).some((post) => post.message.includes(message));
    expect(found).toBe(true);
}

/** Asserts team search returns a post containing the given terms. */
export async function assertSearchFinds(client: Client4, teamId: string, terms: string): Promise<void> {
    const results = await client.searchPosts(teamId, terms, false);
    const found = Object.values(results.posts).some((post) => post.message.includes(terms));
    expect(found).toBe(true);
}

/** Uploads a profile image for the given user via Client4. */
export async function uploadUpgradeProfileImage(client: Client4, userId: string, fileName: string): Promise<void> {
    await client.uploadProfileImage(userId, getFileFromAsset(fileName));
}

/**
 * Asserts a user's profile picture returns non-empty bytes.
 * Uses Playwright's `request` fixture (not raw fetch / browser navigation).
 */
export async function assertProfileImageFetchable(
    request: APIRequestContext,
    client: Client4,
    userId: string,
): Promise<void> {
    const user = await client.getUser(userId);
    const url = client.getProfilePictureUrl(userId, user.last_picture_update || 0);
    const response = await request.get(url, {
        headers: {Authorization: `Bearer ${client.getToken()}`},
    });
    expect(response.ok()).toBe(true);
    expect((await response.body()).byteLength).toBeGreaterThan(0);
}

export type ServerIdentity = {
    serverVersion: string;
    buildNumber: string;
};

/** Reads server Version + BuildNumber from the client config API. */
export async function readServerIdentity(client: Client4): Promise<ServerIdentity> {
    // Prime X-Version-Id on the client session.
    await client.getMe();
    const config = await client.getClientConfig();
    return {
        serverVersion: config.Version || client.getServerVersion(),
        buildNumber: config.BuildNumber || '',
    };
}

/** Asserts the server reports a licensed Enterprise deployment. */
export async function assertLicensed(client: Client4): Promise<void> {
    const license = await client.getClientLicenseOld();
    expect(license.IsLicensed).toBe('true');
}

/** Installs (if needed) and enables the upgrade demo plugin; asserts it is active. */
export async function ensureUpgradePluginActive(request: APIRequestContext, client: Client4): Promise<void> {
    // Demo plugin refuses to activate unless public links are enabled.
    try {
        await client.patchConfig({
            FileSettings: {
                EnablePublicLink: true,
            },
        } as any);
    } catch {
        // Older images may reject unknown file settings keys.
    }

    const bundlePath = await ensurePluginBundleDownloaded(request);
    const status = await getPluginStatus(client, UPGRADE_PLUGIN_ID);

    if (!status.isInstalled) {
        const fileData = getFileData(bundlePath);
        await client.uploadPlugin(fileData, true);
    }

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
        const current = await getPluginStatus(client, UPGRADE_PLUGIN_ID);
        if (current.isActive) {
            return;
        }
        try {
            await client.enablePlugin(UPGRADE_PLUGIN_ID);
        } catch {
            // Transient activation race — retry until deadline.
        }
        await new Promise((r) => setTimeout(r, 1000));
    }

    const finalStatus = await getPluginStatus(client, UPGRADE_PLUGIN_ID);
    expect(finalStatus.isInstalled).toBe(true);
    expect(finalStatus.isActive).toBe(true);
}

/** Downloads the demo plugin bundle via Playwright `request` (not raw fetch). */
export async function ensurePluginBundleDownloaded(request: APIRequestContext): Promise<string> {
    if (fs.existsSync(UPGRADE_PLUGIN_BUNDLE_PATH)) {
        return UPGRADE_PLUGIN_BUNDLE_PATH;
    }
    const response = await request.get(UPGRADE_PLUGIN_BUNDLE_URL);
    if (!response.ok()) {
        throw new Error(`Failed to download plugin bundle: ${response.status()} ${response.statusText()}`);
    }
    fs.writeFileSync(UPGRADE_PLUGIN_BUNDLE_PATH, await response.body());
    return UPGRADE_PLUGIN_BUNDLE_PATH;
}

export type UpgradeBaseline = {
    serverVersion: string;
    buildNumber: string;
    userId: string;
    adminUserId: string;
    publicChannelId: string;
    privateChannelId: string;
    userDmChannelId: string;
    userGmChannelId: string;
    adminDmChannelId: string;
    adminGmChannelId: string;
    attachmentPostId: string;
    avatarPostId: string;
    adminAttachmentPostId: string;
    minioAttachmentPostId?: string;
    azuriteAttachmentPostId?: string;
};

/** Persists the from-phase's captured state, for upgrade-to to compare against. */
export function writeUpgradeBaseline(baseline: UpgradeBaseline): void {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline), 'utf-8');
}

export function readUpgradeBaseline(): UpgradeBaseline {
    if (!fs.existsSync(BASELINE_PATH)) {
        throw new Error(`${BASELINE_PATH} not found — did the upgrade-from project run first?`);
    }
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
}

/**
 * Confirms a post's attachment is served by the active file backend.
 * Metadata via Client4; binary download via Playwright `request` (not raw fetch / browser UI).
 */
export async function verifyPostAttachmentDownloadable(
    request: APIRequestContext,
    client: Client4,
    postId: string,
    fileName: string,
): Promise<void> {
    const post = await client.getPost(postId);
    expect(post.file_ids?.length).toBeGreaterThan(0);

    const fileInfos = await Promise.all(post.file_ids!.map((fileId) => client.getFileInfo(fileId)));
    const fileInfo = fileInfos.find((info) => info.name === fileName);
    expect(fileInfo).toBeDefined();

    const downloadResponse = await request.get(client.getFileUrl(fileInfo!.id, 0), {
        headers: {Authorization: `Bearer ${client.getToken()}`},
    });
    expect(downloadResponse.ok()).toBe(true);
    expect((await downloadResponse.body()).byteLength).toBeGreaterThan(0);
}
