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
     * Use Mattermost Entry tier (ignores MM_LICENSE, enables EnableMattermostEntry flag).
     * Only applicable to enterprise and fips editions (not team edition).
     * @default false
     * @env TC_ENTRY
     */
    entry?: boolean;
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
    entry: boolean;
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
export declare function defineConfig(config: TestcontainersConfig): TestcontainersConfig;
/**
 * Base image names for Mattermost editions.
 */
export declare const MATTERMOST_EDITION_IMAGES: Record<MattermostEdition, string>;
/**
 * Default server tag.
 */
export declare const DEFAULT_SERVER_TAG = "master";
/**
 * Default image max age in hours.
 */
export declare const DEFAULT_IMAGE_MAX_AGE_HOURS = 24;
/**
 * Default output directory for all testcontainers artifacts.
 */
export declare const DEFAULT_OUTPUT_DIR = ".tc.out";
/**
 * Default admin credentials.
 */
export declare const DEFAULT_ADMIN: {
    username: string;
    password: string;
};
/**
 * Default configuration values.
 */
export declare const DEFAULT_CONFIG: ResolvedTestcontainersConfig;
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
export declare function resolveConfig(userConfig?: TestcontainersConfig): ResolvedTestcontainersConfig;
/**
 * Log the resolved configuration.
 *
 * @param logger Function to log messages
 * @param config Resolved configuration to log
 */
export declare function logConfig(logger: (message: string) => void, config: ResolvedTestcontainersConfig): void;
/**
 * Load a config file based on its extension.
 * Supports .mjs (ES module) and .jsonc (JSON with comments).
 *
 * @param configPath Path to the config file
 * @returns The config or undefined if loading fails
 */
export declare function loadConfigFile(configPath: string): Promise<TestcontainersConfig | undefined>;
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
 * 1. Path provided via TC_CONFIG environment variable
 * 2. Current working directory
 * 3. Parent directories up to the repository root (detected via .git), otherwise up to filesystem root
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
export declare function discoverAndLoadConfig(options?: DiscoverConfigOptions): Promise<ResolvedTestcontainersConfig>;
