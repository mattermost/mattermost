// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Fixed seed data shared across separate upgrade-from and upgrade-to processes (see `seeder`).

import fs from 'node:fs';
import path from 'node:path';

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';
import type {APIRequestContext} from '@playwright/test';

import {
    expect,
    getFileData,
    getFileFromAsset,
    getPluginStatus,
    listAzuriteBlobNames,
    listLocalStorageFiles,
    listMinioObjectKeys,
    playbooksPluginId,
    testConfig,
} from '@mattermost/playwright-lib';

const BASELINE_PATH = path.resolve(process.cwd(), '.upgrade_baseline.json');

/** Attachment files from `asset/`, spread across channel types in upgrade-from. */
export type UpgradeAttachmentSeed = {
    fileName: string;
    message: string;
    author: 'user' | 'admin';
    channel: 'public' | 'private' | 'dm';
};

/** Fixed seed data shared across upgrade-from and upgrade-to processes. */
export const seeder = {
    UPGRADE_TEAM_NAME: 'upgrade-test',
    UPGRADE_PUBLIC_CHANNEL_NAME: 'upgrade-public',
    UPGRADE_PRIVATE_CHANNEL_NAME: 'upgrade-private',

    UPGRADE_USER: {
        username: 'upgradetestuser',
        email: 'upgradetestuser@sample.mattermost.com',
        password: 'Upgradetestuser123!',
        first_name: 'Upgrade',
        last_name: 'User',
    } as UserProfile,

    UPGRADE_PEER_USERS: [
        {
            username: 'upgradetestpeer1',
            email: 'upgradetestpeer1@sample.mattermost.com',
            password: 'Upgradetestpeer123!',
        },
        {
            username: 'upgradetestpeer2',
            email: 'upgradetestpeer2@sample.mattermost.com',
            password: 'Upgradetestpeer123!',
        },
        {
            username: 'upgradetestpeer3',
            email: 'upgradetestpeer3@sample.mattermost.com',
            password: 'Upgradetestpeer123!',
        },
    ].map((u) => u as UserProfile),

    UPGRADE_PUBLIC_MESSAGE: 'upgrade-check public channel message',
    UPGRADE_PRIVATE_MESSAGE: 'upgrade-check private channel message',
    UPGRADE_DM_MESSAGE: 'upgrade-check direct message',
    UPGRADE_GM_MESSAGE: 'upgrade-check group message',
    UPGRADE_SEARCH_MESSAGE: 'upgrade-check searchable-marker-abc123',
    UPGRADE_PROFILE_PHOTO_FILE: 'mattermost-icon_128x128.png',
    UPGRADE_ADMIN_ATTACHMENT_MESSAGE: 'upgrade-check admin attachment message',

    UPGRADE_ATTACHMENT_SEEDS: [
        {
            fileName: 'small-image.png',
            message: 'upgrade-check public png attachment',
            author: 'user',
            channel: 'public',
        },
        {
            fileName: 'sample_text_file.txt',
            message: 'upgrade-check private text attachment',
            author: 'user',
            channel: 'private',
        },
        {
            fileName: 'mattermost.png',
            message: 'upgrade-check admin attachment message',
            author: 'admin',
            channel: 'public',
        },
        {
            fileName: 'image-400x40.jpg',
            message: 'upgrade-check dm jpeg attachment',
            author: 'user',
            channel: 'dm',
        },
    ] as UpgradeAttachmentSeed[],

    UPGRADE_ADMIN_PUBLIC_MESSAGE: 'upgrade-check admin public channel message',
    UPGRADE_ADMIN_PRIVATE_MESSAGE: 'upgrade-check admin private channel message',
    UPGRADE_ADMIN_DM_MESSAGE: 'upgrade-check admin direct message',
    UPGRADE_ADMIN_GM_MESSAGE: 'upgrade-check admin group message',
    UPGRADE_ADMIN_SEARCH_MESSAGE: 'upgrade-check admin-searchable-marker-xyz789',
    UPGRADE_ADMIN_AVATAR_MESSAGE: 'upgrade-check admin avatar message',

    UPGRADE_PLUGIN_ID: 'com.mattermost.demo-plugin',
    UPGRADE_PLUGIN_BUNDLE_URL:
        'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.11.0/mattermost-plugin-demo-v0.11.0.tar.gz',
    UPGRADE_PLUGIN_BUNDLE_PATH: path.resolve(process.cwd(), '.upgrade_plugin_bundle.tar.gz'),
};

/** Prepackaged plugin exercised across upgrade-from → upgrade-to (enabled in the from-spec). */
export const UPGRADE_PREPACKAGED_PLUGIN_ID = playbooksPluginId;

export function channelIdForAttachmentSeed(
    channel: UpgradeAttachmentSeed['channel'],
    channels: {publicId: string; privateId: string; userDmId: string},
): string {
    switch (channel) {
        case 'public':
            return channels.publicId;
        case 'private':
            return channels.privateId;
        case 'dm':
            return channels.userDmId;
        default: {
            const exhaustive: never = channel;
            throw new Error(`Unknown attachment seed channel: ${exhaustive}`);
        }
    }
}

/** Looks up the shared upgrade-test team, creating it on first (from-phase) run. */
export async function ensureUpgradeTeam(adminClient: Client4) {
    try {
        return await adminClient.getTeamByName(seeder.UPGRADE_TEAM_NAME);
    } catch {
        return adminClient.createTeam({
            name: seeder.UPGRADE_TEAM_NAME,
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

/** Adds the user to the channel only when not already a member (avoids "already a member" warns). */
export async function ensureChannelMember(adminClient: Client4, userId: string, channelId: string): Promise<void> {
    try {
        await adminClient.getChannelMember(channelId, userId);
    } catch {
        await adminClient.addToChannel(userId, channelId);
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

/** Seeds attachment posts from `seeder.UPGRADE_ATTACHMENT_SEEDS` and verifies each upload on the active file backend. */
export async function seedUpgradeAttachments(
    request: APIRequestContext,
    userClient: Client4,
    adminClient: Client4,
    channels: {publicId: string; privateId: string; userDmId: string},
): Promise<UpgradeAttachmentBaseline[]> {
    const clientFor = (author: 'user' | 'admin') => (author === 'user' ? userClient : adminClient);

    const baseline: UpgradeAttachmentBaseline[] = [];
    for (const seed of seeder.UPGRADE_ATTACHMENT_SEEDS) {
        const client = clientFor(seed.author);
        const post = await postWithAttachment(
            client,
            channelIdForAttachmentSeed(seed.channel, channels),
            seed.message,
            seed.fileName,
        );
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
 * Persist it to Postgres as well so license state is dual-sourced (env + DB) across the swap.
 * upgrade-swap-to keeps the same host MM_LICENSE as upgrade-from; upgrade-to compares baseline.
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

/** Schema migration snapshot from GET /api/v4/system/schema/version (db_migrations). */
export type UpgradeSchemaBaseline = {
    versionMax: number;
    count: number;
};

/**
 * Reads applied schema migrations. Returns undefined when the from-image lacks the endpoint
 * or returns an empty list — upgrade-to then skips the schema assert.
 */
export async function readUpgradeSchemaBaseline(client: Client4): Promise<UpgradeSchemaBaseline | undefined> {
    try {
        const migrations = await client.getAppliedSchemaMigrations();
        if (!migrations.length) {
            return undefined;
        }
        return {
            versionMax: Math.max(...migrations.map((m) => m.version)),
            count: migrations.length,
        };
    } catch {
        return undefined;
    }
}

/**
 * Asserts schema migrations did not regress after the to-image swap.
 * Skips when the from-phase could not record a schema baseline.
 * Returns the to-image snapshot for logging.
 */
export async function assertUpgradeSchemaMatches(
    client: Client4,
    baseline: UpgradeBaseline,
): Promise<UpgradeSchemaBaseline | undefined> {
    if (!baseline.schema) {
        return undefined;
    }

    const current = await readUpgradeSchemaBaseline(client);
    expect(current).toBeDefined();
    expect(current!.count).toBeGreaterThan(0);
    expect(current!.versionMax).toBeGreaterThanOrEqual(baseline.schema.versionMax);
    expect(current!.count).toBeGreaterThanOrEqual(baseline.schema.count);
    return current;
}

/** Asserts the server reports a licensed Enterprise deployment. */
export async function assertLicensed(client: Client4): Promise<void> {
    const license = await readUpgradeLicenseBaseline(client);
    expect(license.isLicensed).toBe(true);
}

/**
 * Upgrade harness defaults via patchConfig (not MM_* boot env) so later tests can override
 * without a container restart. Call before creating users / seeding files.
 * Patches are applied in sections so a from-image rejection fails clearly on that section.
 */
export async function ensureUpgradeServerConfig(client: Client4): Promise<void> {
    await client.patchConfig({
        EmailSettings: {
            SendEmailNotifications: true,
        },
        FileSettings: {
            EnablePublicLink: true,
        },
        ServiceSettings: {
            SiteURL: testConfig.internalBaseURL,
        },
    } as Parameters<typeof client.patchConfig>[0]);

    await client.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: false,
            EnableUserManagedAttributes: false,
        },
    } as Parameters<typeof client.patchConfig>[0]);

    // No PluginStates here — patchConfig replaces that map wholesale, which would undo whatever
    // the specs enabled. Plugin enablement is per-id via enablePlugin, and recorded in the
    // baseline. EnableUploads is likewise absent: SERVER_ENV_BASELINE owns it and the API 403s.
    await client.patchConfig({
        PluginSettings: {
            Enable: true,
            AllowInsecureDownloadURL: true,
        },
    } as Parameters<typeof client.patchConfig>[0]);
}

/** Installs (if needed) and enables the upgrade demo plugin; asserts it is active. */
export async function ensureUpgradePluginActive(request: APIRequestContext, client: Client4): Promise<void> {
    // Only the plugin's own settings — PluginStates is left alone so this does not undo the
    // playbooks enablement the from-spec just recorded in the baseline.
    await client.patchConfig({
        PluginSettings: {
            Plugins: {
                [seeder.UPGRADE_PLUGIN_ID]: {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                },
            },
        },
    } as Parameters<typeof client.patchConfig>[0]);

    const bundlePath = await ensurePluginBundleDownloaded(request);
    const status = await getPluginStatus(client, seeder.UPGRADE_PLUGIN_ID);

    if (!status.isInstalled) {
        const fileData = getFileData(bundlePath);
        await client.uploadPlugin(fileData, true);
    }
    if (!status.isActive) {
        await client.enablePlugin(seeder.UPGRADE_PLUGIN_ID);
    }

    // Activation is asynchronous server-side, so poll rather than assert immediately.
    await expect
        .poll(() => getPluginStatus(client, seeder.UPGRADE_PLUGIN_ID), {timeout: 30000})
        .toEqual({
            isInstalled: true,
            isActive: true,
        });
}

/** Snapshot of a prepackaged plugin's config + runtime state for upgrade-to comparison. */
export type UpgradePrepackagedPluginBaseline = {
    pluginId: string;
    configEnabled: boolean;
    isInstalled: boolean;
    isActive: boolean;
    version: string;
};

/** Reads PluginStates + getPlugins for a prepackaged plugin id. */
export async function readUpgradePrepackagedPluginBaseline(
    client: Client4,
    pluginId: string = UPGRADE_PREPACKAGED_PLUGIN_ID,
): Promise<UpgradePrepackagedPluginBaseline> {
    const config = await client.getConfig();
    const plugins = await client.getPlugins();
    const active = plugins.active.find((p) => p.id === pluginId);
    const inactive = plugins.inactive.find((p) => p.id === pluginId);
    const manifest = active || inactive;

    return {
        pluginId,
        configEnabled: Boolean(config.PluginSettings?.PluginStates?.[pluginId]?.Enable),
        isInstalled: Boolean(manifest),
        isActive: Boolean(active),
        version: manifest?.version || '',
    };
}

/**
 * Enables the upgrade prepackaged plugin (playbooks) via the enablePlugin API — not boot env.
 * Returns the observed state for the upgrade baseline.
 */
export async function ensureUpgradePlaybooksEnabled(client: Client4): Promise<UpgradePrepackagedPluginBaseline> {
    const initial = await getPluginStatus(client, UPGRADE_PREPACKAGED_PLUGIN_ID);
    expect(initial.isInstalled).toBe(true);

    if (!initial.isActive) {
        await client.enablePlugin(UPGRADE_PREPACKAGED_PLUGIN_ID);
    }

    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        const current = await getPluginStatus(client, UPGRADE_PREPACKAGED_PLUGIN_ID);
        if (current.isActive) {
            break;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }

    const baseline = await readUpgradePrepackagedPluginBaseline(client);
    expect(baseline.isInstalled).toBe(true);
    expect(baseline.isActive).toBe(true);
    expect(baseline.configEnabled).toBe(true);
    return baseline;
}

/**
 * Asserts playbooks plugin state after upgrade matches the from-image baseline.
 * Read-only — does not re-enable or patchConfig PluginStates.
 */
export async function assertUpgradePlaybooksMatches(client: Client4, baseline: UpgradeBaseline): Promise<void> {
    expect(baseline.playbooks).toBeDefined();
    const current = await readUpgradePrepackagedPluginBaseline(client, baseline.playbooks!.pluginId);

    expect(current.pluginId).toBe(baseline.playbooks!.pluginId);
    expect(current.isInstalled).toBe(baseline.playbooks!.isInstalled);
    expect(current.isActive).toBe(baseline.playbooks!.isActive);
    expect(current.configEnabled).toBe(baseline.playbooks!.configEnabled);
}

/** Downloads the demo plugin bundle via Playwright `request` (not raw fetch). */
export async function ensurePluginBundleDownloaded(request: APIRequestContext): Promise<string> {
    if (fs.existsSync(seeder.UPGRADE_PLUGIN_BUNDLE_PATH)) {
        return seeder.UPGRADE_PLUGIN_BUNDLE_PATH;
    }

    const attempts = 3;
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const response = await request.get(seeder.UPGRADE_PLUGIN_BUNDLE_URL);
        if (response.ok()) {
            fs.writeFileSync(seeder.UPGRADE_PLUGIN_BUNDLE_PATH, await response.body());
            return seeder.UPGRADE_PLUGIN_BUNDLE_PATH;
        }
        lastError = new Error(
            `Failed to download plugin bundle (attempt ${attempt}/${attempts}): ${response.status()} ${response.statusText()}`,
        );
        if (attempt < attempts) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
    }
    throw lastError ?? new Error('Failed to download plugin bundle');
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

/** Process-local cache so serial upgrade tests do not re-GET/re-add membership every time. */
let upgradeFromContextCache: UpgradeFromContext | undefined;

export function clearUpgradeFromContextCache(): void {
    upgradeFromContextCache = undefined;
}

/** Idempotently ensures shared upgrade actors/channels and returns API clients for from-phase tests. */
export async function loadUpgradeFromContext(pw: {
    getAdminClient: () => Promise<{adminClient: Client4}>;
    makeClient: (user: UserProfile) => Promise<{client: Client4 | undefined}>;
}): Promise<UpgradeFromContext> {
    if (upgradeFromContextCache) {
        return upgradeFromContextCache;
    }

    const {adminClient} = await pw.getAdminClient();
    await ensureUpgradeServerConfig(adminClient);

    const team = await ensureUpgradeTeam(adminClient);
    const user = await ensureUpgradeUser(adminClient, team.id, seeder.UPGRADE_USER);
    const peers = await Promise.all(
        seeder.UPGRADE_PEER_USERS.map((peer) => ensureUpgradeUser(adminClient, team.id, peer)),
    );
    const publicChannel = await ensureUpgradeChannel(adminClient, team.id, seeder.UPGRADE_PUBLIC_CHANNEL_NAME, 'O');
    const privateChannel = await ensureUpgradeChannel(adminClient, team.id, seeder.UPGRADE_PRIVATE_CHANNEL_NAME, 'P');

    // Membership only on first ensure — re-calling addToChannel every test logs "already a member".
    await ensureChannelMember(adminClient, user.id, publicChannel.id);
    await ensureChannelMember(adminClient, user.id, privateChannel.id);

    const adminMe = await adminClient.getMe();
    await ensureChannelMember(adminClient, adminMe.id, publicChannel.id);
    await ensureChannelMember(adminClient, adminMe.id, privateChannel.id);

    const {client: userClient} = await pw.makeClient(user);
    expect(userClient).toBeTruthy();

    upgradeFromContextCache = {
        adminClient,
        userClient: userClient!,
        adminMe,
        user,
        peers,
        publicChannel,
        privateChannel,
    };
    return upgradeFromContextCache;
}

export type UpgradeBaseline = {
    serverVersion: string;
    buildNumber: string;
    /** Highest db_migrations.Version (+ count) on the from-image; upgrade-to asserts it did not regress. */
    schema?: UpgradeSchemaBaseline;
    /** FileSettings.DriverName active when from-phase seeded attachments/profile images. */
    fileDriverName: string;
    /** License on the from-image; upgrade-to asserts it still matches after swap (same env as from). */
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
    /** Prepackaged playbooks state from upgrade-from; upgrade-to asserts it without re-enabling. */
    playbooks?: UpgradePrepackagedPluginBaseline;
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
    clearUpgradeFromContextCache();
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

    const attachments = baseline.attachments ?? ([] as UpgradeAttachmentBaseline[]);

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
