/**
 * Server mode for the environment.
 * - 'container': Run Mattermost in a Docker container (default)
 * - 'local': Connect to a locally running Mattermost server (dependencies only)
 */
export type ServerMode = 'container' | 'local';
/**
 * Format elapsed time in a human-readable format.
 * Shows decimal if < 10s, whole seconds if < 60s, otherwise minutes and seconds.
 */
export declare function formatElapsed(ms: number): string;
