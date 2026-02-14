// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';

import {imageExistsLocally as imageExistsLocallyFn} from './docker_cli';

/**
 * Check if a Docker image exists locally.
 *
 * @param image The image name (e.g., 'postgres:14')
 * @returns true if the image exists locally, false otherwise
 */
export function imageExistsLocally(image: string): boolean {
    return imageExistsLocallyFn(image);
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
            execFileSync('docker', ['pull', image], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}
