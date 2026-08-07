// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import {spawnSync, type SpawnSyncReturns} from 'child_process';

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const CLI_PATH = path.join(PROJECT_ROOT, 'dist', 'cli.js');

/**
 * Skip reason for Docker integration tests.
 * Returns undefined if TC_DOCKER_TESTS=true, otherwise a skip reason string.
 */
export const SKIP_DOCKER = process.env.TC_DOCKER_TESTS
    ? undefined
    : 'Set TC_DOCKER_TESTS=true to run Docker integration tests';

/**
 * Skip reason for HA Docker integration tests.
 * Returns undefined if both TC_DOCKER_TESTS=true and MM_LICENSE are set, otherwise a skip reason string.
 */
export const SKIP_DOCKER_HA = (() => {
    if (!process.env.TC_DOCKER_TESTS) {
        return 'Set TC_DOCKER_TESTS=true to run Docker integration tests';
    }
    if (!process.env.MM_LICENSE) {
        return 'Set MM_LICENSE to run HA integration tests';
    }
    return undefined;
})();

/**
 * Strip ANSI escape codes from a string (safety net — NO_COLOR=1 should prevent them).
 */
export function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Simple HTTP GET helper. Returns status code, body, and headers.
 * Follows up to 5 redirects (301/302/307/308) automatically.
 */
export function httpGet(
    url: string,
    maxRedirects = 5,
): Promise<{statusCode: number; body: string; headers: http.IncomingHttpHeaders}> {
    return new Promise((resolve, reject) => {
        const doGet = (targetUrl: string, redirectsLeft: number) => {
            const req = http.get(targetUrl, (res) => {
                const status = res.statusCode ?? 0;

                // Follow redirects
                if ([301, 302, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
                    // Resolve relative redirects against the current URL
                    const nextUrl = new URL(res.headers.location, targetUrl).href;
                    res.resume(); // drain response
                    doGet(nextUrl, redirectsLeft - 1);
                    return;
                }

                let body = '';
                res.on('data', (chunk: Buffer) => {
                    body += chunk.toString();
                });
                res.on('end', () => {
                    resolve({
                        statusCode: status,
                        body,
                        headers: res.headers,
                    });
                });
            });
            req.on('error', reject);
            req.setTimeout(10_000, () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });
        };

        doGet(url, maxRedirects);
    });
}

interface RunCliResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

/**
 * Run the CLI with given args. Returns status, stdout, stderr with ANSI codes stripped.
 */
export function runCli(args: string[], opts?: {timeout?: number; cwd?: string}): RunCliResult {
    const result: SpawnSyncReturns<string> = spawnSync('node', [CLI_PATH, ...args], {
        timeout: opts?.timeout ?? 300_000,
        encoding: 'utf-8',
        env: {...process.env, NO_COLOR: '1'},
        cwd: opts?.cwd ?? PROJECT_ROOT,
    });

    return {
        status: result.status,
        stdout: stripAnsi(result.stdout || ''),
        stderr: stripAnsi(result.stderr || ''),
    };
}

/**
 * Verify prerequisites: dist/cli.js exists and Docker is available.
 */
export function verifyPrerequisites(): void {
    if (!fs.existsSync(CLI_PATH)) {
        throw new Error(`Built CLI not found at ${CLI_PATH}. Run "npm run build" first.`);
    }

    const dockerCheck = spawnSync('docker', ['info'], {timeout: 15_000, encoding: 'utf-8'});
    if (dockerCheck.status !== 0) {
        throw new Error('Docker is not available. Ensure Docker is running.');
    }
}

/**
 * Best-effort cleanup of an output directory: try `rm --yes` first, fallback to fs.rmSync.
 */
export function cleanupOutputDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        return;
    }

    const rmResult = runCli(['rm', '-o', dir, '--yes'], {timeout: 60_000});
    if (rmResult.status !== 0 && fs.existsSync(dir)) {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

/**
 * Read and parse the .tc.docker.json file from an output directory.
 */
export function readDockerInfo(dir: string): Record<string, unknown> {
    const dockerInfoPath = path.join(dir, '.tc.docker.json');
    if (!fs.existsSync(dockerInfoPath)) {
        throw new Error(`.tc.docker.json not found at ${dockerInfoPath}`);
    }
    return JSON.parse(fs.readFileSync(dockerInfoPath, 'utf-8'));
}

/**
 * Assert that the Mattermost server at the given URL is healthy.
 * Hits /api/v4/system/ping and checks for 200 + {"status":"OK"} + X-Version-Id header.
 * Retries up to `maxRetries` times with exponential back-off (useful after restart).
 */
export async function assertServerHealthy(
    url: string,
    maxRetries = 5,
): Promise<{statusCode: number; body: string; headers: http.IncomingHttpHeaders}> {
    const pingUrl = url.replace(/\/$/, '') + '/api/v4/system/ping';
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await httpGet(pingUrl);

            if (response.statusCode !== 200) {
                throw new Error(`Expected 200 from ${pingUrl}, got ${response.statusCode}`);
            }

            const body = JSON.parse(response.body);
            if (body.status !== 'OK') {
                throw new Error(`Expected status "OK" from ${pingUrl}, got "${body.status}"`);
            }

            if (!response.headers['x-version-id']) {
                throw new Error(`Expected X-Version-Id header from ${pingUrl}`);
            }

            return response;
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
                // Exponential back-off: 1s, 2s, 4s, 8s, 16s
                const delay = 1000 * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError!;
}

/**
 * Assert that the server at the given URL is unreachable (connection refused or timeout).
 */
export async function assertServerUnreachable(url: string): Promise<void> {
    const pingUrl = url.replace(/\/$/, '') + '/api/v4/system/ping';
    try {
        await httpGet(pingUrl);
        throw new Error(`Expected connection to ${pingUrl} to fail, but it succeeded`);
    } catch (error) {
        const err = error as Error;
        // Connection refused or timeout is expected
        if (err.message.includes('succeeded')) {
            throw err;
        }
        // ECONNREFUSED, ECONNRESET, timeout — all expected
    }
}
