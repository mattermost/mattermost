// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientError} from '@mattermost/client';
import type {Client4} from '@mattermost/client';
import type {PluginManifest} from '@mattermost/types/plugins';
import {expect} from '@playwright/test';

import {getAdminClient} from './init';

import {duration} from '@/util';
import {
    aiPluginId,
    callsPluginId,
    demoPluginId,
    demoPluginUrl,
    demoPluginVersion,
    npsPluginId,
    playbooksPluginId,
} from '@/constant';

/** The prepackaged plugins model.Config.SetDefaults() enables, so active on a fresh install. */
export const defaultEnabledPluginIds = [aiPluginId, callsPluginId, npsPluginId, playbooksPluginId];

/** Deactivates every active plugin outside the default set plus `keep`, returning what it disabled. */
export async function disableUnexpectedPlugins(client: Client4, keep: string[] = []): Promise<string[]> {
    const expected = new Set([...defaultEnabledPluginIds, ...keep]);
    const {active} = await client.getPlugins();
    const unexpected = active.filter((plugin: PluginManifest) => !expected.has(plugin.id)).map((plugin) => plugin.id);

    for (const pluginId of unexpected) {
        await client.disablePlugin(pluginId);
    }

    return unexpected;
}

export async function isPluginActive(client: Client4, pluginId: string): Promise<boolean> {
    const plugins = await client.getPlugins();
    return plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
}

export async function getPluginStatus(
    client: Client4,
    pluginId: string,
): Promise<{isInstalled: boolean; isActive: boolean}> {
    const plugins = await client.getPlugins();

    const isActive = plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
    const isInactive = plugins.inactive.some((plugin: PluginManifest) => plugin.id === pluginId);

    return {
        isInstalled: isActive || isInactive,
        isActive,
    };
}

async function getInstalledPluginVersion(client: Client4, pluginId: string): Promise<string | undefined> {
    const plugins = await client.getPlugins();
    return [...plugins.active, ...plugins.inactive].find((plugin: PluginManifest) => plugin.id === pluginId)
        ?.version;
}

/**
 * Installs and enables a plugin with smart status checking
 * - If already active: does nothing
 * - If already installed: just enables it
 * - Otherwise: installs from URL, then enables
 */
export async function installAndEnablePlugin(
    client: Client4,
    pluginUrl: string,
    pluginId: string,
    force = true,
): Promise<void> {
    // Check current status
    const status = await getPluginStatus(client, pluginId);

    // If already active, nothing to do
    if (status.isActive) {
        return;
    }

    // If already installed but not active, just enable it
    if (status.isInstalled) {
        await client.enablePlugin(pluginId);
        return;
    }

    // Not installed - install from URL then enable
    await client.installPluginFromUrl(pluginUrl, force);
    await client.enablePlugin(pluginId);
}

/**
 * installPluginFromUrl can fail with "Unable to restart plugin on upgrade" when activation
 * races (server thinks plugin is still active). Retry once after disable + brief settle.
 */
async function installAndEnableDemoPluginWithRetry(adminClient: Client4): Promise<void> {
    try {
        await installAndEnablePlugin(adminClient, demoPluginUrl, demoPluginId);
    } catch (err) {
        const msg = err instanceof ClientError ? err.message : String(err);
        if (!msg.includes('Unable to restart plugin on upgrade')) {
            throw err;
        }
        try {
            await adminClient.disablePlugin(demoPluginId);
        } catch {
            // Already inactive or transitional — continue.
        }
        await new Promise((r) => setTimeout(r, 2000));
        await installAndEnablePlugin(adminClient, demoPluginUrl, demoPluginId);
    }
}

export type EnsureDemoPluginOptions = {
    /** Enable the plugin after installing/configuring it. Defaults to true. */
    activate?: boolean;
};

/**
 * Installs and configures the demo plugin, activating it by default. Pass `{activate: false}`
 * to ensure it's installed and configured without enabling it (e.g. from the `setup` project,
 * which installs once for the whole run but leaves activation to each spec via the default).
 *
 * Safe to call repeatedly or from multiple specs: nothing else in the suite patches
 * PluginSettings, so there's no concurrent writer that could reset or clobber this config.
 * Calling patchConfig/install/enable when nothing actually needs to change makes the plugin
 * supervisor reload on every call — with dozens of specs each calling this, that repeated
 * reload churn was observed to eventually leave the plugin stuck inactive. So every check
 * below is a no-op read until something is actually found to be missing or stale.
 */
export async function ensureDemoPlugin(options: EnsureDemoPluginOptions = {}): Promise<void> {
    const {activate = true} = options;
    const {adminClient} = await getAdminClient();

    const status = await getPluginStatus(adminClient, demoPluginId);
    const installedVersion = status.isInstalled ? await getInstalledPluginVersion(adminClient, demoPluginId) : undefined;
    const isStale = status.isInstalled && installedVersion !== demoPluginVersion;

    // Already installed at the right version, and either activation isn't requested or it's
    // already active — nothing to do.
    if (status.isInstalled && !isStale && (!activate || status.isActive)) {
        return;
    }

    // No PluginStates here — patchConfig replaces that map wholesale. Enablement goes through
    // installAndEnablePlugin's enablePlugin call, which the server applies to this id alone.
    // EnableUploads is likewise absent: SERVER_ENV_BASELINE owns it and the API 403s on change.
    await adminClient.patchConfig({
        FileSettings: {EnablePublicLink: true},
        ServiceSettings: {EnableGifPicker: true},
        PluginSettings: {
            Enable: true,
            AllowInsecureDownloadURL: true,
            Plugins: {
                [demoPluginId]: {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                },
            },
        },
    });

    // Not installed, or a long-lived reused dev/CI server has a stale version from a previous
    // session — installAndEnablePlugin's "already installed" shortcut would otherwise just
    // re-enable that stale version instead of picking up demoPluginVersion. Force a fresh
    // install (the server keeps it enabled across the replace if it already was).
    if (!status.isInstalled || isStale) {
        await adminClient.installPluginFromUrl(demoPluginUrl, true);
    }

    if (!activate) {
        return;
    }

    if (!(await isPluginActive(adminClient, demoPluginId))) {
        await installAndEnableDemoPluginWithRetry(adminClient);
    }

    // Activation is asynchronous server-side, so poll rather than assert immediately.
    await expect.poll(() => isPluginActive(adminClient, demoPluginId), {timeout: duration.half_min}).toBe(true);
}
