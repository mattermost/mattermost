// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';
import {writeFile} from 'node:fs/promises';

import {request} from '@playwright/test';

import {STORAGE_STATE_DIR} from './constants';
import type {StorageState} from './types';

/**
 * setupAuth Authenticate and save storage state to file
 */
export async function setupAuth(baseUrl: string): Promise<boolean> {
    const username = process.env.MM_ADMIN_USERNAME || 'sysadmin';
    const password = process.env.MM_ADMIN_PASSWORD || 'Sys@dmin-sample1';

    console.log('\nSetting up authentication...');
    console.log(`   URL: ${baseUrl}`);
    console.log(`   User: ${username}`);

    try {
        // Use Playwright's request context for proper cookie handling
        const requestContext = await request.newContext();

        console.log('   Logging in via API...');
        const loginResponse = await requestContext.post(`${baseUrl}/api/v4/users/login`, {
            data: {
                login_id: username,
                password: password,
                token: '',
                deviceId: '',
            },
            headers: {'X-Requested-With': 'XMLHttpRequest'},
        });

        if (!loginResponse.ok()) {
            const errorText = await loginResponse.text();
            throw new Error(`Login failed: ${loginResponse.status()} - ${errorText}`);
        }

        const userData = await loginResponse.json();
        console.log(`   User ID: ${userData.id}`);

        // Ensure storage_state directory exists
        if (!fs.existsSync(STORAGE_STATE_DIR)) {
            fs.mkdirSync(STORAGE_STATE_DIR, {recursive: true});
        }

        // Get storage state from Playwright (includes all cookies properly)
        const timestamp = Date.now();
        const stateFileName = `${timestamp}_${username}.json`;
        const storagePath = path.join(STORAGE_STATE_DIR, stateFileName);

        const storageState = await requestContext.storageState();
        await requestContext.dispose();

        // Log cookies captured
        console.log(`   Cookies captured: ${storageState.cookies.map((c) => c.name).join(', ')}`);

        // Append origins to bypass seeing landing page
        storageState.origins.push({
            origin: baseUrl,
            localStorage: [{name: '__landingPageSeen__', value: 'true'}],
        });

        // Write storage state to file
        await writeFile(storagePath, JSON.stringify(storageState, null, 2));

        console.log(`   Auth saved to: ${stateFileName}`);
        console.log(`   ${storageState.cookies.length} cookies saved`);

        return true;
    } catch (error) {
        console.error(`   [ERROR] Auth setup failed: ${error instanceof Error ? error.message : error}`);
        return false;
    }
}

export function findLatestStorageState(): string | null {
    if (!fs.existsSync(STORAGE_STATE_DIR)) {
        return null;
    }
    const files = fs.readdirSync(STORAGE_STATE_DIR).filter((f) => f.endsWith('.json'));
    if (files.length === 0) return null;
    // Sort by timestamp (filename starts with timestamp)
    files.sort((a, b) => {
        const aTime = parseInt(a.split('_')[0], 10) || 0;
        const bTime = parseInt(b.split('_')[0], 10) || 0;
        return bTime - aTime;
    });
    return path.join(STORAGE_STATE_DIR, files[0]);
}

export function loadStorageState(filePath: string): StorageState | null {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}
