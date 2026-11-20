// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';

import {MANIFEST_PATH} from './paths.ts';

export type SeedManifest = {
    schema: string;
    base_url: string;
    variant: string;
    team: {id: string; name: string; display_name: string};
    user: {id: string; username: string; password: string; email: string; roles: string};
    channels: Record<string, {id: string; name: string; url_path: string; archived: boolean}>;
};

export function readManifest(): SeedManifest {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error('Seed manifest missing: run explorer-proto/infra/scripts/up.sh first.');
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as SeedManifest;
    if (manifest.schema !== 'explorer-pilot-seed/v1') {
        throw new Error(`Unsupported seed manifest schema: ${manifest.schema}`);
    }
    return manifest;
}

export function baseUrl(): string {
    return process.env.PW_BASE_URL || readManifest().base_url;
}

/** Scheme + host + port of the base URL, e.g. http://127.0.0.1:8065. */
export function allowedOrigin(): string {
    const url = new URL(baseUrl());
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
        throw new Error('The explorer only runs against an http://127.0.0.1:<port> base URL.');
    }
    return url.origin;
}

/** The fixed seeded member, shaped like the UserProfile fields TestBrowser.login reads. */
export function seededUser() {
    const {user} = readManifest();
    return {id: user.id, username: user.username, password: user.password, email: user.email, roles: user.roles};
}
