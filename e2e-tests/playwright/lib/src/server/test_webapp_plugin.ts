// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {gzipSync} from 'node:zlib';

import type {Client4} from '@mattermost/client';
import {expect} from '@playwright/test';

import {getAdminClient} from './init';
import {getPluginStatus, isPluginActive} from './plugin';

import {duration} from '@/util';

export const preAuthTestPluginId = 'com.mattermost.e2e-preauth';
export const postAuthTestPluginId = 'com.mattermost.e2e-postauth';

const testWebappPluginVersion = '1.0.0';

export type WebappPluginBundleOptions = {
    id: string;
    version?: string;
    preAuth?: boolean;
};

/** Test id of the hidden element a test webapp plugin appends to `document.body` once initialized. */
export function testWebappPluginMarkerTestId(pluginId: string) {
    return `e2e-plugin-${pluginId}`;
}

/** Path of the custom route a test webapp plugin registers; it renders `e2e route <id>`. */
export function testWebappPluginRoute(pluginId: string) {
    return `/plug/${pluginId}/e2e`;
}

function writeOctal(header: Buffer, value: number, offset: number, length: number) {
    header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'ascii');
}

// Minimal ustar archive writer: regular files only, names shorter than 100 bytes.
function tarFiles(files: Array<{name: string; body: string}>): Buffer {
    const blocks: Buffer[] = [];
    for (const file of files) {
        const body = Buffer.from(file.body, 'utf8');
        const header = Buffer.alloc(512);
        header.write(file.name, 0, 100, 'utf8');
        writeOctal(header, 0o644, 100, 8);
        writeOctal(header, 0, 108, 8);
        writeOctal(header, 0, 116, 8);
        writeOctal(header, body.length, 124, 12);
        writeOctal(header, Math.floor(Date.now() / 1000), 136, 12);
        header.write('        ', 148, 8, 'ascii');
        header.write('0', 156, 1, 'ascii');
        header.write('ustar\0', 257, 6, 'ascii');
        header.write('00', 263, 2, 'ascii');

        let checksum = 0;
        for (const byte of header) {
            checksum += byte;
        }
        header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

        blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
    }
    blocks.push(Buffer.alloc(1024));
    return Buffer.concat(blocks);
}

function webappBundleSource(pluginId: string) {
    const id = JSON.stringify(pluginId);
    return `(function () {
    var id = ${id};
    var markerTestId = ${JSON.stringify(testWebappPluginMarkerTestId(pluginId))};
    window.registerPlugin(id, {
        initialize: function (registry) {
            var marker = document.createElement('div');
            marker.setAttribute('data-testid', markerTestId);
            marker.style.display = 'none';
            document.body.appendChild(marker);

            var React = window.React;
            registry.registerCustomRoute('e2e', function () {
                return React.createElement('div', {'data-testid': 'e2e-route-' + id, style: {gridArea: 'center'}}, 'e2e route ' + id);
            });
        },
        uninitialize: function () {
            var marker = document.querySelector('[data-testid="' + markerTestId + '"]');
            if (marker) {
                marker.remove();
            }
        },
    });
})();
`;
}

/**
 * Builds an in-memory, webapp-only plugin bundle (.tar.gz) for `client.uploadPlugin`.
 * Once initialized, the plugin appends a hidden marker element with test id
 * `testWebappPluginMarkerTestId(id)` and registers the custom route `testWebappPluginRoute(id)`.
 */
export function buildWebappPluginBundle({
    id,
    version = testWebappPluginVersion,
    preAuth = false,
}: WebappPluginBundleOptions): File {
    const manifest = {
        id,
        name: `E2E ${id}`,
        description: `Playwright test plugin ${id}`,
        version,
        min_server_version: '5.0.0',
        webapp: {
            bundle_path: 'webapp/main.js',
            ...(preAuth ? {pre_auth: true} : {}),
        },
    };

    const archive = tarFiles([
        {name: `${id}/plugin.json`, body: JSON.stringify(manifest)},
        {name: `${id}/webapp/main.js`, body: webappBundleSource(id)},
    ]);

    return new File([gzipSync(archive)], `${id}.tar.gz`, {type: 'application/gzip'});
}

async function ensureTestWebappPlugin(client: Client4, id: string, preAuth: boolean) {
    const status = await getPluginStatus(client, id);
    if (!status.isInstalled) {
        await client.uploadPlugin(buildWebappPluginBundle({id, preAuth}), true);
    }
    if (!status.isActive) {
        await client.enablePlugin(id);
    }

    await expect.poll(() => isPluginActive(client, id), {timeout: duration.half_min}).toBe(true);
}

/**
 * Installs and enables two webapp-only test plugins: `preAuthTestPluginId`, which sets
 * `webapp.pre_auth`, and `postAuthTestPluginId`, which does not.
 */
export async function ensureTestWebappPlugins(): Promise<void> {
    const {adminClient} = await getAdminClient();
    await ensureTestWebappPlugin(adminClient, preAuthTestPluginId, true);
    await ensureTestWebappPlugin(adminClient, postAuthTestPluginId, false);
}

/** Removes the plugins installed by `ensureTestWebappPlugins`. */
export async function removeTestWebappPlugins(): Promise<void> {
    const {adminClient} = await getAdminClient();
    for (const id of [preAuthTestPluginId, postAuthTestPluginId]) {
        if ((await getPluginStatus(adminClient, id)).isInstalled) {
            await adminClient.removePlugin(id);
        }
    }
}
