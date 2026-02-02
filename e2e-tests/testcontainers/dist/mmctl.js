// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Client for executing mmctl commands inside a Mattermost container.
 * Uses --local flag to communicate via Unix socket (no authentication required).
 */
export class MmctlClient {
    container;
    constructor(container) {
        this.container = container;
    }
    /**
     * Execute an mmctl command inside the container.
     * The --local flag is automatically added to use Unix socket communication.
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
    async exec(command) {
        // Split the command into arguments
        const args = this.parseCommand(command);
        // Execute mmctl with --local flag inside the container
        const result = await this.container.exec(['mmctl', '--local', ...args]);
        return {
            exitCode: result.exitCode,
            stdout: result.output,
            stderr: '', // testcontainers combines stdout/stderr in output
        };
    }
    /**
     * Parse a command string into an array of arguments.
     * Handles quoted strings properly.
     */
    parseCommand(command) {
        const args = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';
        for (const char of command) {
            if ((char === '"' || char === "'") && !inQuote) {
                inQuote = true;
                quoteChar = char;
            }
            else if (char === quoteChar && inQuote) {
                inQuote = false;
                quoteChar = '';
            }
            else if (char === ' ' && !inQuote) {
                if (current) {
                    args.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }
        if (current) {
            args.push(current);
        }
        return args;
    }
}
