import { type ResolvedTestcontainersConfig } from '../config/config';
/**
 * Prepare output directory for a new session.
 * Deletes existing directory if present and creates it fresh.
 *
 * @param outputDir Output directory path
 * @returns Path to the output directory
 */
export declare function prepareOutputDirectory(outputDir: string): string;
/**
 * Apply CLI options on top of resolved config.
 * CLI options have the highest priority in the configuration hierarchy:
 * 1. CLI flags (highest)
 * 2. Environment variables
 * 3. Config file
 * 4. Built-in defaults (lowest)
 */
export declare function applyCliOverrides(config: ResolvedTestcontainersConfig, options: {
    edition?: string;
    tag?: string;
    serviceEnv?: string;
    deps?: string;
    outputDir?: string;
    ha?: boolean;
    subpath?: boolean;
    entry?: boolean;
    admin?: boolean | string;
    adminPassword?: string;
    env?: string[];
    envFile?: string;
}): ResolvedTestcontainersConfig;
/**
 * Build server environment variables from config, env file, and CLI options.
 * Priority (highest to lowest): CLI -E options > --env-file > config file server.env
 */
export declare function buildServerEnv(config: ResolvedTestcontainersConfig, options: {
    env?: string[];
    envFile?: string;
    serviceEnv?: string;
    depsOnly?: boolean;
}): Record<string, string>;
