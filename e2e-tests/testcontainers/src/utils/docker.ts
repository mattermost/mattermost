// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

/**
 * Check if a Docker image exists locally.
 *
 * @param image The image name (e.g., 'postgres:14')
 * @returns true if the image exists locally, false otherwise
 */
export function imageExistsLocally(image: string): boolean {
    try {
        const result = execSync(`docker images -q "${image}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * Pull a Docker image if it doesn't exist locally.
 *
 * @param image The image name to pull
 * @param onPullStart Callback when pull starts
 * @returns true if the image was pulled, false if it already existed
 */
export async function pullImageIfNeeded(image: string, onPullStart?: () => void): Promise<boolean> {
    if (imageExistsLocally(image)) {
        return false;
    }

    onPullStart?.();

    return new Promise((resolve, reject) => {
        try {
            execSync(`docker pull "${image}"`, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}
