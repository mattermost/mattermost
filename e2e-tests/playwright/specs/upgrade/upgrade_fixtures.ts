// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Shared actors/content for the upgrade-from / upgrade-to specs. Fixed (not random) names, since
// upgrade-from and upgrade-to run in separate processes and must find the same team/users/channels
// created earlier rather than random ones.

import fs from 'node:fs';
import path from 'node:path';

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

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
    try {
        const existing = await adminClient.getUserByUsername(spec.username);
        return {...existing, password: spec.password} as UserProfile;
    } catch {
        const created = await adminClient.createUser(spec, '', '');
        await adminClient.addToTeam(teamId, created.id);
        return {...created, password: spec.password} as UserProfile;
    }
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

/** Downloads the demo plugin bundle to a fixed local path, for the UI upload flow to attach. */
export async function ensurePluginBundleDownloaded(): Promise<string> {
    if (fs.existsSync(UPGRADE_PLUGIN_BUNDLE_PATH)) {
        return UPGRADE_PLUGIN_BUNDLE_PATH;
    }
    const response = await fetch(UPGRADE_PLUGIN_BUNDLE_URL);
    if (!response.ok) {
        throw new Error(`Failed to download plugin bundle: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(UPGRADE_PLUGIN_BUNDLE_PATH, buffer);
    return UPGRADE_PLUGIN_BUNDLE_PATH;
}

export type UpgradeBaseline = {
    serverVersion: string;
    buildNumber: string;
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
