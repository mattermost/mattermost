import { StartedTestContainer } from 'testcontainers';
/**
 * Result of executing an mmctl command
 */
export interface MmctlExecResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
/**
 * Client for executing mmctl commands inside a Mattermost container.
 * Uses --local flag to communicate via Unix socket (no authentication required).
 */
export declare class MmctlClient {
    private container;
    constructor(container: StartedTestContainer);
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
    exec(command: string): Promise<MmctlExecResult>;
    /**
     * Parse a command string into an array of arguments.
     * Handles quoted strings properly.
     */
    private parseCommand;
}
