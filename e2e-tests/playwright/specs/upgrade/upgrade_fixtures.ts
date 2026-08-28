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

import {expect, getFileData, getFileFromAsset, getPluginStatus, listAzuriteBlobNames, listLocalStorageFiles, listMinioObjectKeys, testConfig} from '@mattermost/playwright-lib';

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
export const UPGRADE_PROFILE_PHOTO_FILE = 'mattermost-icon_128x128.png';
export const UPGRADE_ADMIN_ATTACHMENT_MESSAGE = 'upgrade-check admin attachment message';

/** Attachment files from `asset/`, spread across channel types in upgrade-from. */
export type UpgradeAttachmentSeed = {
    fileName: string;
    message: string;
    author: 'user' | 'admin';
    channel: 'public' | 'private' | 'dm';
};

export const UPGRADE_ATTACHMENT_SEEDS: UpgradeAttachmentSeed[] = [
    {fileName: 'small-image.png', message: 'upgrade-check public png attachment', author: 'user', channel: 'public'},
    {
        fileName: 'sample_text_file.txt',
        message: 'upgrade-check private text attachment',
        author: 'user',
        channel: 'private',
    },
    {fileName: 'mattermost.png', message: UPGRADE_ADMIN_ATTACHMENT_MESSAGE, author: 'admin', channel: 'public'},
    {fileName: 'image-400x40.jpg', message: 'upgrade-check dm jpeg attachment', author: 'user', channel: 'dm'},
];

export const UPGRADE_ADMIN_PUBLIC_MESSAGE = 'upgrade-check admin public channel message';
export const UPGRADE_ADMIN_PRIVATE_MESSAGE = 'upgrade-check admin private channel message';
export const UPGRADE_ADMIN_DM_MESSAGE = 'upgrade-check admin direct message';
export const UPGRADE_ADMIN_GM_MESSAGE = 'upgrade-check admin group message';
export const UPGRADE_ADMIN_SEARCH_MESSAGE = 'upgrade-check admin-searchable-marker-xyz789';
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

export type UpgradeAttachmentBaseline = {
    postId: string;
    fileName: string;
    author: 'user' | 'admin';
};

/** Seeds attachment posts from `UPGRADE_ATTACHMENT_SEEDS` and verifies each upload on the active file backend. */
export async function seedUpgradeAttachments(
    request: APIRequestContext,
    userClient: Client4,
    adminClient: Client4,
    channels: {publicId: string; privateId: string; userDmId: string},
): Promise<UpgradeAttachmentBaseline[]> {
    const clientFor = (author: 'user' | 'admin') => (author === 'user' ? userClient : adminClient);
    const channelFor = (channel: UpgradeAttachmentSeed['channel']) => {
        switch (channel) {
            case 'public':
                return channels.publicId;
            case 'private':
                return channels.privateId;
            case 'dm':
                return channels.userDmId;
        }
    };

    const baseline: UpgradeAttachmentBaseline[] = [];
    for (const seed of UPGRADE_ATTACHMENT_SEEDS) {
        const client = clientFor(seed.author);
        const post = await postWithAttachment(client, channelFor(seed.channel), seed.message, seed.fileName);
        await verifyPostAttachmentDownloadable(request, client, post.id, seed.fileName);
        baseline.push({postId: post.id, fileName: seed.fileName, author: seed.author});
    }
    return baseline;
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

/** Reads FileSettings.DriverName from the running server (local, amazons3, azureblob, …). */
export async function readFileDriverName(client: Client4): Promise<string> {
    const config = await client.getConfig();
    return config.FileSettings?.DriverName || 'local';
}

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

/** License state captured on the from-image for post-upgrade comparison. */
export type UpgradeLicenseBaseline = {
    isLicensed: boolean;
    skuShortName?: string;
    skuName?: string;
    isTrial?: boolean;
    users?: string;
};

/**
 * MM_LICENSE at container boot sets an in-memory license only (LoadLicense env path).
 * Persist it to Postgres so upgrade-to can reload it without MM_LICENSE env.
 */
export async function persistUpgradeLicenseFromEnv(client: Client4): Promise<void> {
    const licenseKey = process.env.MM_LICENSE?.trim();
    if (!licenseKey) {
        return;
    }

    const file = new File([licenseKey], 'license.mattermost', {type: 'application/octet-stream'});
    await client.uploadLicense(file);
}

/** Reads the current server license into a baseline-friendly shape. */
export async function readUpgradeLicenseBaseline(client: Client4): Promise<UpgradeLicenseBaseline> {
    const license = await client.getClientLicenseOld();
    if (license.IsLicensed !== 'true') {
        return {isLicensed: false};
    }

    return {
        isLicensed: true,
        skuShortName: license.SkuShortName,
        skuName: license.SkuName,
        isTrial: license.IsTrial === 'true',
        users: license.Users,
    };
}

/** Asserts license state after upgrade matches what was recorded on the from-image. */
export async function assertUpgradeLicenseMatches(client: Client4, baseline: UpgradeBaseline): Promise<void> {
    const current = await readUpgradeLicenseBaseline(client);

    if (!baseline.license) {
        expect(current.isLicensed).toBe(true);
        return;
    }

    expect(current.isLicensed).toBe(baseline.license.isLicensed);
    if (!baseline.license.isLicensed) {
        return;
    }

    expect(current.skuShortName).toBe(baseline.license.skuShortName);
    expect(current.skuName).toBe(baseline.license.skuName);
    expect(current.isTrial).toBe(baseline.license.isTrial);
    expect(current.users).toBe(baseline.license.users);
}

/** Asserts the server reports a licensed Enterprise deployment. */
export async function assertLicensed(client: Client4): Promise<void> {
    const license = await readUpgradeLicenseBaseline(client);
    expect(license.isLicensed).toBe(true);
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

export type UpgradeFromContext = {
    adminClient: Client4;
    userClient: Client4;
    adminMe: UserProfile;
    user: UserProfile;
    peers: UserProfile[];
    publicChannel: Channel;
    privateChannel: Channel;
};

/** Idempotently ensures shared upgrade actors/channels and returns API clients for from-phase tests. */
export async function loadUpgradeFromContext(pw: {
    getAdminClient: () => Promise<{adminClient: Client4}>;
    makeClient: (user: UserProfile) => Promise<{client: Client4 | undefined}>;
}): Promise<UpgradeFromContext> {
    const {adminClient} = await pw.getAdminClient();
    const team = await ensureUpgradeTeam(adminClient);
    const user = await ensureUpgradeUser(adminClient, team.id, UPGRADE_USER);
    const peers = await Promise.all(UPGRADE_PEER_USERS.map((peer) => ensureUpgradeUser(adminClient, team.id, peer)));
    const publicChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PUBLIC_CHANNEL_NAME, 'O');
    const privateChannel = await ensureUpgradeChannel(adminClient, team.id, UPGRADE_PRIVATE_CHANNEL_NAME, 'P');

    await adminClient.addToChannel(user.id, publicChannel.id);
    await adminClient.addToChannel(user.id, privateChannel.id);

    const adminMe = await adminClient.getMe();
    await adminClient.addToChannel(adminMe.id, publicChannel.id);
    await adminClient.addToChannel(adminMe.id, privateChannel.id);

    const {client: userClient} = await pw.makeClient(user);
    expect(userClient).toBeTruthy();

    return {adminClient, userClient: userClient!, adminMe, user, peers, publicChannel, privateChannel};
}

export type UpgradeBaseline = {
    serverVersion: string;
    buildNumber: string;
    /** FileSettings.DriverName active when from-phase seeded attachments/profile images. */
    fileDriverName: string;
    /** License on the from-image; upgrade-to re-checks after swap without MM_LICENSE env. */
    license: UpgradeLicenseBaseline;
    userId: string;
    adminUserId: string;
    publicChannelId: string;
    privateChannelId: string;
    userDmChannelId: string;
    userGmChannelId: string;
    adminDmChannelId: string;
    adminGmChannelId: string;
    attachments: UpgradeAttachmentBaseline[];
    avatarPostId: string;
};

export type UpgradeToContext = UpgradeFromContext & {
    baseline: UpgradeBaseline;
    publicChannelId: string;
    privateChannelId: string;
};

/** Loads shared upgrade actors/clients plus the from-phase baseline for upgrade-to verification. */
export async function loadUpgradeToContext(pw: {
    getAdminClient: () => Promise<{adminClient: Client4}>;
    makeClient: (user: UserProfile) => Promise<{client: Client4 | undefined}>;
}): Promise<UpgradeToContext> {
    const baseline = readUpgradeBaseline();
    const ctx = await loadUpgradeFromContext(pw);
    return {
        ...ctx,
        baseline,
        publicChannelId: baseline.publicChannelId || ctx.publicChannel.id,
        privateChannelId: baseline.privateChannelId || ctx.privateChannel.id,
    };
}

/** Persists the from-phase's captured state, for upgrade-to to compare against. */
export function writeUpgradeBaseline(baseline: UpgradeBaseline): void {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), 'utf-8');
}

/** Removes any prior baseline before a fresh upgrade-from run. */
export function clearUpgradeBaseline(): void {
    if (fs.existsSync(BASELINE_PATH)) {
        fs.unlinkSync(BASELINE_PATH);
    }
}

/** Merges partial baseline fields as each upgrade-from test completes. */
export function mergeUpgradeBaseline(partial: Partial<UpgradeBaseline>): UpgradeBaseline {
    const existing: Partial<UpgradeBaseline> = fs.existsSync(BASELINE_PATH)
        ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
        : {};
    const merged = {...existing, ...partial} as UpgradeBaseline;
    writeUpgradeBaseline(merged);
    return merged;
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

/**
 * Re-checks file-backed upgrade data after the to-image swap. Uses whatever
 * FileSettings.DriverName the server reports — never restarts or patchConfig's the driver.
 * API download checks apply to every backend; optional sidecar/object-store probes match the driver.
 */
export async function assertUpgradeFileBackendMatches(
    request: APIRequestContext,
    adminClient: Client4,
    userClient: Client4,
    baseline: UpgradeBaseline,
): Promise<void> {
    const currentDriver = await readFileDriverName(adminClient);
    if (baseline.fileDriverName) {
        expect(currentDriver).toBe(baseline.fileDriverName);
    }

    const attachments =
        baseline.attachments ??
        ([] as UpgradeAttachmentBaseline[]);

    for (const {postId, fileName, author} of attachments) {
        const client = author === 'user' ? userClient : adminClient;
        await verifyPostAttachmentDownloadable(request, client, postId, fileName);
    }

    await assertProfileImageFetchable(request, userClient, baseline.userId);

    switch (currentDriver) {
        case 'local':
            expect(listLocalStorageFiles().length).toBeGreaterThan(0);
            break;
        case 'amazons3':
            if (testConfig.testcontainersServices.includes('minio')) {
                expect((await listMinioObjectKeys()).length).toBeGreaterThan(0);
            }
            break;
        case 'azureblob':
            if (testConfig.testcontainersServices.includes('azurite')) {
                expect((await listAzuriteBlobNames()).length).toBeGreaterThan(0);
            }
            break;
        default:
            break;
    }
}
