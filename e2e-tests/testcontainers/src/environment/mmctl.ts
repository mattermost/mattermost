// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StartedTestContainer} from 'testcontainers';

/** Max retries for transient failures (e.g. cluster settling) */
const MAX_RETRIES = 4;

/** Initial back-off delay in milliseconds */
const INITIAL_DELAY_MS = 500;

/** Patterns that indicate a transient error worth retrying */
const TRANSIENT_ERROR_PATTERNS = [
    'Timed out waiting for cluster response',
    'cluster response timeout',
    'connection refused',
    'context deadline exceeded',
];

/** Patterns in thrown exceptions that indicate a transient Docker error worth retrying */
const TRANSIENT_EXCEPTION_PATTERNS = [
    'no such exec',
    'no such container',
    'container stopped',
    'container paused',
    'is not running',
    'is restarting',
];

/**
 * Result of executing an mmctl command
 */
export interface MmctlExecResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

/**
 * Parse a command string into an array of arguments.
 * Handles quoted strings properly.
 */
export function parseCommand(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of command) {
        if ((char === '"' || char === "'") && !inQuote) {
            inQuote = true;
            quoteChar = char;
        } else if (char === quoteChar && inQuote) {
            inQuote = false;
            quoteChar = '';
        } else if (char === ' ' && !inQuote) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        args.push(current);
    }

    return args;
}

/**
 * Client for executing mmctl commands inside a Mattermost container.
 * Uses --local flag to communicate via Unix socket (no authentication required).
 */
export class MmctlClient {
    private container: StartedTestContainer;

    constructor(container: StartedTestContainer) {
        this.container = container;
    }

    /**
     * Execute an mmctl command inside the container.
     * The --local flag is automatically added to use Unix socket communication.
     *
     * Retries with exponential back-off on transient errors (e.g. cluster timeouts
     * while HA nodes are still settling).
     *
     * @param command - The mmctl command to execute (without 'mmctl' prefix)
     * @returns Promise<MmctlExecResult> - The result of the command execution
     *
     * @example
     * // Create a user
     * await mmctl.exec('user create --email test@test.com --username testuser --password Test123!');
     *
     * @example
     * // Get system info
     * const result = await mmctl.exec('system version');
     * console.log(result.stdout);
     *
     * @example
     * // Run a test command
     * await mmctl.exec('sampledata --teams 5 --users 100');
     */
    async exec(command: string): Promise<MmctlExecResult> {
        const args = parseCommand(command);

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            let result;
            try {
                result = await this.container.exec(['mmctl', '--local', ...args]);
            } catch (error) {
                // Docker-level exceptions (container restarting, exec instance gone, etc.)
                const message = error instanceof Error ? error.message : String(error);
                const isTransientException = TRANSIENT_EXCEPTION_PATTERNS.some((p) => message.includes(p));

                if (!isTransientException || attempt === MAX_RETRIES) {
                    throw error;
                }

                const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            const output = result.output;
            const isTransient = result.exitCode !== 0 && TRANSIENT_ERROR_PATTERNS.some((p) => output.includes(p));

            if (!isTransient || attempt === MAX_RETRIES) {
                return {
                    exitCode: result.exitCode,
                    stdout: output,
                    stderr: '',
                };
            }

            // Exponential back-off: 500ms, 1s, 2s, 4s
            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Unreachable, but satisfies TypeScript
        throw new Error('Unexpected: exceeded retry loop');
    }
}
