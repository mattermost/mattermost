// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { parse as parseJsonc } from 'jsonc-parser';
import { z } from 'zod';
import { DEFAULT_IMAGES, IMAGE_ENV_VARS } from './defaults';
/**
 * Supported config file names in priority order.
 * .mjs is preferred for flexibility (dynamic config, environment-based logic).
 * .jsonc is supported for simpler static configurations.
 */
const CONFIG_FILE_NAMES = ['mm-tc.config.mjs', 'mm-tc.config.jsonc'];
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
export function defineConfig(config) {
    return config;
}
/**
 * Base image names for Mattermost editions.
 */
export const MATTERMOST_EDITION_IMAGES = {
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
export const DEFAULT_CONFIG = {
    server: {
        edition: 'enterprise',
        tag: DEFAULT_SERVER_TAG,
        image: `${MATTERMOST_EDITION_IMAGES.enterprise}:${DEFAULT_SERVER_TAG}`,
        imageMaxAgeHours: DEFAULT_IMAGE_MAX_AGE_HOURS,
        ha: false,
        subpath: false,
        entry: false,
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
let cachedConfigSchema = null;
function getConfigSchema() {
    if (cachedConfigSchema) {
        return cachedConfigSchema;
    }
    const MattermostEditionSchema = z.enum(['enterprise', 'fips', 'team']);
    const ServiceEnvironmentSchema = z.enum(['test', 'production', 'dev']);
    const AdminConfigSchema = z
        .object({
        username: z.string().min(1, 'admin.username must be non-empty'),
        password: z.string().optional(),
    })
        .strict();
    const ServerConfigSchema = z
        .object({
        edition: MattermostEditionSchema.optional(),
        entry: z.boolean().optional(),
        tag: z.string().min(1).optional(),
        serviceEnvironment: ServiceEnvironmentSchema.optional(),
        env: z.record(z.string(), z.string()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        imageMaxAgeHours: z.number().nonnegative().optional(),
        ha: z.boolean().optional(),
        subpath: z.boolean().optional(),
    })
        .strict();
    const ImagesSchema = z
        .object({
        postgres: z.string(),
        inbucket: z.string(),
        openldap: z.string(),
        keycloak: z.string(),
        minio: z.string(),
        elasticsearch: z.string(),
        opensearch: z.string(),
        redis: z.string(),
        dejavu: z.string(),
        prometheus: z.string(),
        grafana: z.string(),
        loki: z.string(),
        promtail: z.string(),
        nginx: z.string(),
    })
        .partial()
        .strict();
    cachedConfigSchema = z
        .object({
        server: ServerConfigSchema.optional(),
        dependencies: z.array(z.string()).optional(),
        images: ImagesSchema.optional(),
        outputDir: z.string().optional(),
        admin: AdminConfigSchema.optional(),
    })
        .strict();
    return cachedConfigSchema;
}
function formatZodError(error) {
    return error.issues
        .map((issue) => {
        const p = issue.path.length ? issue.path.join('.') : '<root>';
        return `- ${p}: ${issue.message}`;
    })
        .join('\n');
}
function validateUserConfigOrThrow(config, sourcePath) {
    const schema = getConfigSchema();
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
        const timestamp = new Date().toISOString();
        const details = formatZodError(parsed.error);
        const msg = `[${timestamp}] [tc] Invalid testcontainers config: ${sourcePath}\n` +
            `${details}\n` +
            'Fix the config file or remove it to fall back to defaults.';
        throw new Error(msg);
    }
    return parsed.data;
}
/**
 * Helper to parse boolean from environment variable.
 */
function parseBoolEnv(value) {
    if (value === undefined)
        return undefined;
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
export function resolveConfig(userConfig) {
    // Start with defaults
    const resolved = {
        ...DEFAULT_CONFIG,
        server: { ...DEFAULT_CONFIG.server },
        images: { ...DEFAULT_CONFIG.images },
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
                resolved.server.env = { ...userConfig.server.env };
            }
            if (userConfig.server.config) {
                resolved.server.config = { ...userConfig.server.config };
            }
            if (userConfig.server.ha !== undefined) {
                resolved.server.ha = userConfig.server.ha;
            }
            if (userConfig.server.subpath !== undefined) {
                resolved.server.subpath = userConfig.server.subpath;
            }
            if (userConfig.server.entry !== undefined) {
                resolved.server.entry = userConfig.server.entry;
            }
        }
        // Dependencies
        if (userConfig.dependencies) {
            resolved.dependencies = userConfig.dependencies;
        }
        // Images
        if (userConfig.images) {
            resolved.images = { ...resolved.images, ...userConfig.images };
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
            resolved.server.edition = edition;
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
    // Entry tier mode
    const entryEnv = parseBoolEnv(process.env.TC_ENTRY);
    if (entryEnv !== undefined) {
        resolved.server.entry = entryEnv;
    }
    // Admin config from environment
    if (process.env.TC_ADMIN_USERNAME) {
        const username = process.env.TC_ADMIN_USERNAME;
        resolved.admin = {
            username,
            password: process.env.TC_ADMIN_PASSWORD || resolved.admin?.password || DEFAULT_ADMIN.password,
            email: `${username}@sample.mattermost.com`,
        };
    }
    else if (resolved.admin) {
        // Update existing admin config with env overrides
        if (process.env.TC_ADMIN_PASSWORD) {
            resolved.admin.password = process.env.TC_ADMIN_PASSWORD;
        }
        // Re-derive email from username in case username changed
        resolved.admin.email = `${resolved.admin.username}@sample.mattermost.com`;
    }
    // Apply image overrides from environment
    const imageKeys = Object.keys(resolved.images);
    for (const key of imageKeys) {
        const envVar = IMAGE_ENV_VARS[key];
        if (envVar && process.env[envVar]) {
            resolved.images[key] = process.env[envVar];
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
 * Log the resolved configuration.
 *
 * @param logger Function to log messages
 * @param config Resolved configuration to log
 */
export function logConfig(logger, config) {
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
export async function loadConfigFile(configPath) {
    try {
        if (configPath.endsWith('.jsonc')) {
            const content = fs.readFileSync(configPath, 'utf-8');
            return parseJsonc(content);
        }
        // Default: treat as ES module (.mjs)
        const module = await import(pathToFileURL(configPath).href);
        return module.default || module;
    }
    catch {
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
function findConfigFile(dir) {
    for (const fileName of CONFIG_FILE_NAMES) {
        const filePath = path.join(dir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return undefined;
}
/**
 * Find the git repository root by walking up until a directory contains a .git entry.
 * Returns undefined if no git root is found before reaching the filesystem root.
 */
function findGitRoot(startDir) {
    let currentDir = startDir;
    // Guard: if startDir doesn't exist (edge case), bail out
    if (!fs.existsSync(currentDir)) {
        return undefined;
    }
    // Walk up to filesystem root
    // Stop when .git exists (file or directory)
    // If not found, return undefined
    while (true) {
        const gitPath = path.join(currentDir, '.git');
        if (fs.existsSync(gitPath)) {
            return currentDir;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
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
export async function discoverAndLoadConfig(options) {
    let configPath;
    // If explicit config file is provided, use it directly
    if (options?.configFile) {
        configPath = path.resolve(options.configFile);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }
    }
    else if (process.env.TC_CONFIG) {
        // Environment override for config path
        configPath = path.resolve(process.env.TC_CONFIG);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found from TC_CONFIG: ${configPath}`);
        }
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] Using config from TC_CONFIG: ${configPath}\n`);
    }
    else {
        // Auto-discover config file
        const startDir = options?.searchDir || process.cwd();
        let currentDir = startDir;
        const gitRoot = findGitRoot(startDir);
        // Search current and parent directories, stopping at git root (if found) or filesystem root
        while (true) {
            configPath = findConfigFile(currentDir);
            if (configPath) {
                break;
            }
            // Stop at git root boundary if detected
            if (gitRoot && currentDir === gitRoot) {
                break;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached root
            }
            currentDir = parentDir;
        }
    }
    let userConfig;
    if (configPath) {
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] Found config: ${configPath}\n`);
        userConfig = await loadConfigFile(configPath);
        if (!userConfig) {
            throw new Error(`Failed to load config: ${configPath}`);
        }
        // Validate schema for user-provided config
        userConfig = validateUserConfigOrThrow(userConfig, configPath);
    }
    else {
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] No config found. Using defaults (env overrides may still apply).\n`);
    }
    return resolveConfig(userConfig);
}
