// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {parse as parseJsonc} from 'jsonc-parser';

import {DEFAULT_IMAGES, IMAGE_ENV_VARS} from './defaults';

/**
 * Supported config file names in priority order.
 * .mjs is preferred for flexibility (dynamic config, environment-based logic).
 * .jsonc is supported for simpler static configurations.
 */
const CONFIG_FILE_NAMES = ['mm-tc.config.mjs', 'mm-tc.config.jsonc'] as const;

/**
 * Mattermost edition type.
 * - 'enterprise': Standard enterprise edition (default)
 * - 'fips': FIPS-compliant enterprise edition
 * - 'team': Open source team edition
 */
export type MattermostEdition = 'enterprise' | 'fips' | 'team';

/**
 * Service environment type.
 */
export type ServiceEnvironment = 'test' | 'production' | 'dev';

/**
 * Admin user configuration.
 */
export interface AdminConfig {
    /**
     * Admin username.
     * Email is derived as '<username>@sample.mattermost.com'.
     * @default 'sysadmin'
     * @env TC_ADMIN_USERNAME
     */
    username: string;

    /**
     * Admin password.
     * @default 'Sys@dmin-sample1'
     * @env TC_ADMIN_PASSWORD
     */
    password?: string;
}

/**
 * Mattermost server image configuration.
 */
export interface MattermostImageConfig {
    /**
     * Mattermost edition.
     * - 'enterprise': mattermostdevelopment/mattermost-enterprise-edition (default)
     * - 'fips': mattermostdevelopment/mattermost-enterprise-fips-edition
     * - 'team': mattermostdevelopment/mattermost-team-edition
     * @default 'enterprise'
     * @env TC_EDITION
     */
    edition?: MattermostEdition;

    /**
     * Image tag (e.g., 'master', 'release-11.4').
     * @default 'master'
     * @env TC_SERVER_TAG
     */
    tag?: string;

    /**
     * Service environment (test, production, or dev).
     * This is set via MM_SERVICEENVIRONMENT env var (cannot be set via mmctl).
     * - 'test': Default for container mode
     * - 'dev': Default for deps-only mode (local development)
     * - 'production': Production mode
     * @default 'test' (container mode) or 'dev' (deps-only mode)
     * @env MM_SERVICEENVIRONMENT
     */
    serviceEnvironment?: ServiceEnvironment;

    /**
     * Environment variables to pass to the Mattermost server container.
     * Useful for feature flags and settings that can only be set via env vars.
     * @example { MM_FEATUREFLAGS_MOVETHREADSENABLED: 'true', MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES: 'true' }
     */
    env?: Record<string, string>;

    /**
     * Mattermost server configuration to patch via mmctl after server is ready.
     * This is a partial config object that will be merged with the server's config.
     * @example { ServiceSettings: { EnableOpenServer: false }, TeamSettings: { MaxUsersPerTeam: 100 } }
     */
    config?: Record<string, unknown>;

    /**
     * Maximum age for :master tag images before forcing a pull (in hours).
     * Set to 0 to always pull, Infinity to never force pull.
     * Only applies to :master tag.
     * @default 24
     * @env TC_IMAGE_MAX_AGE_HOURS
     */
    imageMaxAgeHours?: number;

    /**
     * Enable high-availability mode (3-node cluster with nginx load balancer).
     * Requires MM_LICENSE environment variable.
     * @default false
     * @env TC_HA
     */
    ha?: boolean;

    /**
     * Enable subpath mode (2 servers behind nginx at /mattermost1 and /mattermost2).
     * @default false
     * @env TC_SUBPATH
     */
    subpath?: boolean;
}

/**
 * Testcontainers configuration interface.
 *
 * Configuration priority (highest to lowest):
 * 1. CLI flags (when using mm-tc CLI)
 * 2. Environment variables
 * 3. Config file
 * 4. Built-in defaults
 *
 * Supported config file formats (in priority order):
 * 1. mm-tc.config.mjs - ES module using defineConfig
 * 2. mm-tc.config.jsonc - JSON with comments
 *
 * @example
 * // mm-tc.config.mjs (recommended)
 * import {defineConfig} from '@mattermost/testcontainers';
 *
 * export default defineConfig({
 *     server: {
 *         edition: 'enterprise',
 *         tag: 'release-11.4',
 *         serviceEnvironment: 'test',
 *         ha: false,
 *         subpath: false,
 *         env: {
 *             MM_FEATUREFLAGS_MOVETHREADSENABLED: 'true',
 *         },
 *     },
 *     dependencies: ['postgres', 'inbucket', 'minio'],
 *     admin: { username: 'sysadmin' },
 * });
 */
export interface TestcontainersConfig {
    /**
     * Mattermost server image configuration.
     * Use this to specify edition and tag separately.
     */
    server?: MattermostImageConfig;

    /**
     * Dependencies to start with the test environment.
     * @default ['postgres', 'inbucket']
     * @env TC_DEPENDENCIES (comma-separated)
     */
    dependencies?: string[];

    /**
     * Container images configuration.
     * Only specify images you want to override from defaults.
     * Each can also be overridden via TC_<SERVICE>_IMAGE environment variable.
     */
    images?: Partial<TestcontainersImages>;

    /**
     * Output directory for all testcontainers artifacts.
     * Contains: logs/ (container logs), .env.tc, .tc.docker.json, .tc.server.config.json, etc.
     * @default '.tc.out' (in current working directory)
     * @env TC_OUTPUT_DIR
     */
    outputDir?: string;

    /**
     * Admin user configuration.
     * When specified, creates an admin user after server starts.
     * Email is derived as '<username>@sample.mattermost.com'.
     * @env TC_ADMIN_USERNAME, TC_ADMIN_PASSWORD
     */
    admin?: AdminConfig;
}

/**
 * Container images configuration for supporting dependencies.
 * Mattermost server image is configured via the `server` option.
 */
export interface TestcontainersImages {
    /** @default 'postgres:14' @env TC_POSTGRES_IMAGE */
    postgres: string;
    /** @default 'inbucket/inbucket:stable' @env TC_INBUCKET_IMAGE */
    inbucket: string;
    /** @default 'osixia/openldap:1.4.0' @env TC_OPENLDAP_IMAGE */
    openldap: string;
    /** @default 'quay.io/keycloak/keycloak:23.0.7' @env TC_KEYCLOAK_IMAGE */
    keycloak: string;
    /** @default 'minio/minio:RELEASE.2024-06-22T05-26-45Z' @env TC_MINIO_IMAGE */
    minio: string;
    /** @default 'mattermostdevelopment/mattermost-elasticsearch:8.9.0' @env TC_ELASTICSEARCH_IMAGE */
    elasticsearch: string;
    /** @default 'mattermostdevelopment/mattermost-opensearch:2.7.0' @env TC_OPENSEARCH_IMAGE */
    opensearch: string;
    /** @default 'redis:7.4.0' @env TC_REDIS_IMAGE */
    redis: string;
    /** @default 'appbaseio/dejavu:3.4.2' @env TC_DEJAVU_IMAGE */
    dejavu: string;
    /** @default 'prom/prometheus:v2.46.0' @env TC_PROMETHEUS_IMAGE */
    prometheus: string;
    /** @default 'grafana/grafana:10.4.2' @env TC_GRAFANA_IMAGE */
    grafana: string;
    /** @default 'grafana/loki:3.0.0' @env TC_LOKI_IMAGE */
    loki: string;
    /** @default 'grafana/promtail:3.0.0' @env TC_PROMTAIL_IMAGE */
    promtail: string;
    /** @default 'nginx:1.29.4' @env TC_NGINX_IMAGE (used for HA and subpath modes) */
    nginx: string;
}

/**
 * Resolved Mattermost server configuration.
 */
export interface ResolvedMattermostServer {
    edition: MattermostEdition;
    tag: string;
    image: string;
    imageMaxAgeHours: number;
    serviceEnvironment?: ServiceEnvironment;
    env?: Record<string, string>;
    config?: Record<string, unknown>;
    ha: boolean;
    subpath: boolean;
}

/**
 * Resolved admin configuration.
 */
export interface ResolvedAdminConfig {
    username: string;
    password: string;
    email: string;
}

/**
 * Resolved configuration with all values filled in.
 */
export interface ResolvedTestcontainersConfig {
    server: ResolvedMattermostServer;
    dependencies: string[];
    images: TestcontainersImages;
    outputDir: string;
    admin?: ResolvedAdminConfig;
}

/**
 * Define a testcontainers configuration with full type inference.
 * Recommended for .mjs config files.
 *
 * @example
 * // mm-tc.config.mjs
 * import {defineConfig} from '@mattermost/testcontainers';
 *
 * export default defineConfig({
 *     server: {
 *         edition: 'enterprise',
 *         tag: 'release-11.4',
 *         ha: false,
 *         subpath: false,
 *     },
 *     dependencies: ['postgres', 'inbucket', 'minio'],
 * });
 *
 * @param config The configuration object
 * @returns The same configuration (for type inference)
 */
export function defineConfig(config: TestcontainersConfig): TestcontainersConfig {
    return config;
}

/**
 * Base image names for Mattermost editions.
 */
export const MATTERMOST_EDITION_IMAGES: Record<MattermostEdition, string> = {
    enterprise: 'mattermostdevelopment/mattermost-enterprise-edition',
    fips: 'mattermostdevelopment/mattermost-enterprise-fips-edition',
    team: 'mattermostdevelopment/mattermost-team-edition',
};

/**
 * Default server tag.
 */
export const DEFAULT_SERVER_TAG = 'master';

/**
 * Default image max age in hours.
 */
export const DEFAULT_IMAGE_MAX_AGE_HOURS = 24;

/**
 * Default output directory for all testcontainers artifacts.
 */
export const DEFAULT_OUTPUT_DIR = '.tc.out';

/**
 * Default admin credentials.
 */
export const DEFAULT_ADMIN = {
    username: 'sysadmin',
    password: 'Sys@dmin-sample1',
};

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: ResolvedTestcontainersConfig = {
    server: {
        edition: 'enterprise',
        tag: DEFAULT_SERVER_TAG,
        image: `${MATTERMOST_EDITION_IMAGES.enterprise}:${DEFAULT_SERVER_TAG}`,
        imageMaxAgeHours: DEFAULT_IMAGE_MAX_AGE_HOURS,
        ha: false,
        subpath: false,
    },
    dependencies: ['postgres', 'inbucket'],
    images: {
        postgres: DEFAULT_IMAGES.postgres,
        inbucket: DEFAULT_IMAGES.inbucket,
        openldap: DEFAULT_IMAGES.openldap,
        keycloak: DEFAULT_IMAGES.keycloak,
        minio: DEFAULT_IMAGES.minio,
        elasticsearch: DEFAULT_IMAGES.elasticsearch,
        opensearch: DEFAULT_IMAGES.opensearch,
        redis: DEFAULT_IMAGES.redis,
        dejavu: DEFAULT_IMAGES.dejavu,
        prometheus: DEFAULT_IMAGES.prometheus,
        grafana: DEFAULT_IMAGES.grafana,
        loki: DEFAULT_IMAGES.loki,
        promtail: DEFAULT_IMAGES.promtail,
        nginx: DEFAULT_IMAGES.nginx,
    },
    outputDir: DEFAULT_OUTPUT_DIR,
};

/**
 * Helper to parse boolean from environment variable.
 */
function parseBoolEnv(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    return value.toLowerCase() === 'true';
}

/**
 * Resolve configuration by merging (in priority order, highest to lowest):
 * 1. Environment variables (highest priority)
 * 2. User-provided config (from config file)
 * 3. Default values (lowest priority)
 *
 * Note: CLI flags are applied separately by the CLI and have the highest priority.
 *
 * @param userConfig Optional user configuration to merge with defaults
 * @returns Fully resolved configuration
 */
export function resolveConfig(userConfig?: TestcontainersConfig): ResolvedTestcontainersConfig {
    // Start with defaults
    const resolved: ResolvedTestcontainersConfig = {
        ...DEFAULT_CONFIG,
        server: {...DEFAULT_CONFIG.server},
        images: {...DEFAULT_CONFIG.images},
    };

    // ============================================
    // Layer 1: Apply config file values (lowest priority after defaults)
    // ============================================
    if (userConfig) {
        // Server config
        if (userConfig.server) {
            if (userConfig.server.edition) {
                resolved.server.edition = userConfig.server.edition;
            }
            if (userConfig.server.tag) {
                resolved.server.tag = userConfig.server.tag;
            }
            if (userConfig.server.imageMaxAgeHours !== undefined) {
                resolved.server.imageMaxAgeHours = userConfig.server.imageMaxAgeHours;
            }
            if (userConfig.server.serviceEnvironment) {
                resolved.server.serviceEnvironment = userConfig.server.serviceEnvironment;
            }
            if (userConfig.server.env) {
                resolved.server.env = {...userConfig.server.env};
            }
            if (userConfig.server.config) {
                resolved.server.config = {...userConfig.server.config};
            }
            if (userConfig.server.ha !== undefined) {
                resolved.server.ha = userConfig.server.ha;
            }
            if (userConfig.server.subpath !== undefined) {
                resolved.server.subpath = userConfig.server.subpath;
            }
        }

        // Dependencies
        if (userConfig.dependencies) {
            resolved.dependencies = userConfig.dependencies;
        }

        // Images
        if (userConfig.images) {
            resolved.images = {...resolved.images, ...userConfig.images};
        }

        // Output directory
        if (userConfig.outputDir) {
            resolved.outputDir = userConfig.outputDir;
        }

        // Admin config
        if (userConfig.admin) {
            resolved.admin = {
                username: userConfig.admin.username,
                password: userConfig.admin.password || DEFAULT_ADMIN.password,
                email: `${userConfig.admin.username}@sample.mattermost.com`,
            };
        }
    }

    // ============================================
    // Layer 2: Apply environment variables (higher priority than config file)
    // ============================================

    // Server edition
    if (process.env.TC_EDITION) {
        const edition = process.env.TC_EDITION.toLowerCase();
        if (edition === 'enterprise' || edition === 'fips' || edition === 'team') {
            resolved.server.edition = edition as MattermostEdition;
        }
    }

    // Server tag
    if (process.env.TC_SERVER_TAG) {
        resolved.server.tag = process.env.TC_SERVER_TAG;
    }

    // Image max age
    if (process.env.TC_IMAGE_MAX_AGE_HOURS) {
        resolved.server.imageMaxAgeHours = parseFloat(process.env.TC_IMAGE_MAX_AGE_HOURS);
    }

    // Service environment (MM_SERVICEENVIRONMENT)
    if (process.env.MM_SERVICEENVIRONMENT) {
        const env = process.env.MM_SERVICEENVIRONMENT.toLowerCase();
        if (env === 'test' || env === 'production' || env === 'dev') {
            resolved.server.serviceEnvironment = env;
        }
    }

    // Dependencies
    if (process.env.TC_DEPENDENCIES) {
        resolved.dependencies = process.env.TC_DEPENDENCIES.split(',').map((s) => s.trim());
    }

    // Output directory
    if (process.env.TC_OUTPUT_DIR) {
        resolved.outputDir = process.env.TC_OUTPUT_DIR;
    }

    // HA mode
    const haEnv = parseBoolEnv(process.env.TC_HA);
    if (haEnv !== undefined) {
        resolved.server.ha = haEnv;
    }

    // Subpath mode
    const subpathEnv = parseBoolEnv(process.env.TC_SUBPATH);
    if (subpathEnv !== undefined) {
        resolved.server.subpath = subpathEnv;
    }

    // Admin config from environment
    if (process.env.TC_ADMIN_USERNAME) {
        const username = process.env.TC_ADMIN_USERNAME;
        resolved.admin = {
            username,
            password: process.env.TC_ADMIN_PASSWORD || resolved.admin?.password || DEFAULT_ADMIN.password,
            email: `${username}@sample.mattermost.com`,
        };
    } else if (resolved.admin) {
        // Update existing admin config with env overrides
        if (process.env.TC_ADMIN_PASSWORD) {
            resolved.admin.password = process.env.TC_ADMIN_PASSWORD;
        }
        // Re-derive email from username in case username changed
        resolved.admin.email = `${resolved.admin.username}@sample.mattermost.com`;
    }

    // Apply image overrides from environment
    const imageKeys = Object.keys(resolved.images) as Array<keyof TestcontainersImages>;
    for (const key of imageKeys) {
        const envVar = IMAGE_ENV_VARS[key];
        if (envVar && process.env[envVar]) {
            resolved.images[key] = process.env[envVar] as string;
        }
    }

    // ============================================
    // Validation and derived values
    // ============================================

    // Validate --subpath cannot be used with --ha (they're mutually exclusive in CLI)
    // Note: This is enforced at CLI level, not here, to allow programmatic use

    // Build the full server image from edition and tag (can be overridden by TC_SERVER_IMAGE)
    resolved.server.image = `${MATTERMOST_EDITION_IMAGES[resolved.server.edition]}:${resolved.server.tag}`;

    // Allow full image override via TC_SERVER_IMAGE (highest priority for image)
    if (process.env.TC_SERVER_IMAGE) {
        resolved.server.image = process.env.TC_SERVER_IMAGE;
    }

    return resolved;
}

/**
 * Apply resolved configuration to environment variables.
 * This ensures all parts of the testcontainers library pick up the config values.
 *
 * @param config Resolved configuration to apply
 */
export function applyConfigToEnv(config: ResolvedTestcontainersConfig): void {
    // Apply server image
    process.env.TC_SERVER_IMAGE = config.server.image;

    // Apply other images
    const imageKeys = Object.keys(config.images) as Array<keyof TestcontainersImages>;
    for (const key of imageKeys) {
        const envVar = IMAGE_ENV_VARS[key];
        if (envVar) {
            process.env[envVar] = config.images[key];
        }
    }
}

/**
 * Log the resolved configuration.
 *
 * @param logger Function to log messages
 * @param config Resolved configuration to log
 */
export function logConfig(logger: (message: string) => void, config: ResolvedTestcontainersConfig): void {
    logger('Testcontainers Configuration:');
    logger(`  Server: ${config.server.image} (edition: ${config.server.edition}, tag: ${config.server.tag})`);
    logger(`  Enabled dependencies: ${config.dependencies.join(', ')}`);
    logger(`  Image max age: ${config.server.imageMaxAgeHours} hours`);
    if (config.server.ha) {
        logger('  HA mode: enabled (3-node cluster)');
    }
    if (config.server.subpath) {
        logger('  Subpath mode: enabled (/mattermost1, /mattermost2)');
    }
    if (config.admin) {
        logger(`  Admin user: ${config.admin.username}`);
    }
}

/**
 * Load a config file based on its extension.
 * Supports .mjs (ES module) and .jsonc (JSON with comments).
 *
 * @param configPath Path to the config file
 * @returns The config or undefined if loading fails
 */
export async function loadConfigFile(configPath: string): Promise<TestcontainersConfig | undefined> {
    try {
        if (configPath.endsWith('.jsonc')) {
            const content = fs.readFileSync(configPath, 'utf-8');
            return parseJsonc(content) as TestcontainersConfig;
        }

        // Default: treat as ES module (.mjs)
        const module = await import(configPath);
        return module.default || module;
    } catch {
        return undefined;
    }
}

/**
 * Find a config file in the given directory.
 * Searches for supported config file names in priority order.
 *
 * @param dir Directory to search in
 * @returns Path to config file if found, undefined otherwise
 */
function findConfigFile(dir: string): string | undefined {
    for (const fileName of CONFIG_FILE_NAMES) {
        const filePath = path.join(dir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return undefined;
}

export interface DiscoverConfigOptions {
    /**
     * Explicit path to config file. If provided, skips auto-discovery.
     * Supports .mjs and .jsonc files.
     */
    configFile?: string;

    /**
     * Directory to start searching from (defaults to cwd).
     * Only used when configFile is not provided.
     */
    searchDir?: string;
}

/**
 * Discover and load the testcontainers configuration.
 *
 * If configFile is provided, loads that specific file.
 * Otherwise, searches for a config file in the following locations (in order):
 * 1. Current working directory
 * 2. Parent directories (up to 5 levels)
 *
 * If no config file is found, returns resolved default configuration.
 *
 * @param options Configuration options (configFile or searchDir)
 * @returns Resolved configuration
 *
 * @example
 * // Automatically discovers mm-tc.config.mjs or mm-tc.config.jsonc
 * const config = await discoverAndLoadConfig();
 *
 * @example
 * // Load a specific config file
 * const config = await discoverAndLoadConfig({ configFile: './custom-config.mjs' });
 */
export async function discoverAndLoadConfig(options?: DiscoverConfigOptions): Promise<ResolvedTestcontainersConfig> {
    let configPath: string | undefined;

    // If explicit config file is provided, use it directly
    if (options?.configFile) {
        configPath = path.resolve(options.configFile);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }
    } else {
        // Auto-discover config file
        const startDir = options?.searchDir || process.cwd();
        let currentDir = startDir;

        // Search current and parent directories (up to 5 levels)
        for (let i = 0; i < 5; i++) {
            configPath = findConfigFile(currentDir);
            if (configPath) {
                break;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached root
            }
            currentDir = parentDir;
        }
    }

    let userConfig: TestcontainersConfig | undefined;
    if (configPath) {
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] Found config: ${configPath}\n`);
        userConfig = await loadConfigFile(configPath);
    }

    return resolveConfig(userConfig);
}
