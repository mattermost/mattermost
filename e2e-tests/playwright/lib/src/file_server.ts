// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fork, type ChildProcess} from 'node:child_process';
import path from 'node:path';

import {test} from './test_fixture';

/**
 * Starts a server that serves files from ./asset. When run from the monorepo, this will serve files from
 * e2e-tests/playwright/asset.
 *
 * The server will be started automatically by beforeAll and then cleaned up by afterAll.
 *
 * @returns A promise that resolves to the URL of the file server
 */
export function setupFileServer(): Promise<string> {
    return new Promise((resolve, reject) => {
        let fileServer: ChildProcess;

        test.beforeAll(async () => {
            try {
                resolve(await startFileServer());
            } catch (err) {
                reject(err);
            }
        });

        test.afterAll(() => {
            fileServer?.kill();
        });

        function startFileServer(): Promise<string> {
            const playwrightRoot = process.cwd();
            const serverPath = path.join(playwrightRoot, 'mock_file_server.js');

            return new Promise<string>((resolve, reject) => {
                fileServer = fork(serverPath, [], {
                    env: {...process.env, PORT: '0', ASSET_DIR: path.join(playwrightRoot, 'asset')},
                    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
                });

                const timeout = setTimeout(
                    () => reject(new Error('Timed out waiting for the mock file server to start')),
                    10000,
                );

                fileServer.once('message', (message: {type?: string; port?: number}) => {
                    if (message?.type === 'listening' && message.port) {
                        clearTimeout(timeout);
                        resolve(`http://localhost:${message.port}`);
                    }
                });

                fileServer.once('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });
        }
    });
}
