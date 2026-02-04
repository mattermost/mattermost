import type { ContainerInfo } from './types';
/**
 * Upgrade a single Mattermost container to a new image.
 * Preserves the same port, network, and environment configuration.
 */
export declare function upgradeContainer(execSync: typeof import('child_process').execSync, containerKey: string, containerInfo: ContainerInfo, newImage: string): Promise<{
    success: boolean;
    newContainerId?: string;
    error?: string;
}>;
/**
 * Wait for a container to be ready by checking its health endpoint.
 */
export declare function waitForContainer(url: string, maxWaitMs?: number): Promise<boolean>;
/**
 * Get the server version from the ping endpoint.
 * Returns just the version number (e.g., "11.4.0") instead of the full version string.
 */
export declare function getServerVersion(url: string): Promise<string>;
/**
 * Get server config from a running container using mmctl.
 */
export declare function getServerConfig(execSync: typeof import('child_process').execSync, containerId: string): Record<string, unknown> | null;
/**
 * Deep compare two objects and return paths that differ.
 */
export declare function findConfigDiffs(before: Record<string, unknown>, after: Record<string, unknown>, pathPrefix?: string): Array<{
    path: string;
    before: unknown;
    after: unknown;
}>;
/**
 * Save config diff files for an operation (restart, upgrade, etc.).
 * - Saves before config to `.tc.before.{operation}.server.config.json`
 * - Updates `.tc.server.config.json` with after config
 * - Generates `.tc.diff.{operation}.server.config.jsonc` with comments showing previous values
 */
export declare function saveConfigDiff(outputDir: string, operation: string, beforeConfig: Record<string, unknown> | null, afterConfig: Record<string, unknown> | null): void;
