// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';

import * as dotenv from 'dotenv';

import {
    MATTERMOST_EDITION_IMAGES,
    DEFAULT_ADMIN,
    type ResolvedTestcontainersConfig,
    type MattermostEdition,
    type ServiceEnvironment,
} from '../config/config';

/**
 * Prepare output directory for a new session.
 * Deletes existing directory if present and creates it fresh.
 *
 * @param outputDir Output directory path
 * @returns Path to the output directory
 */
export function prepareOutputDirectory(outputDir: string): string {
    // Delete existing directory if it exists
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, {recursive: true, force: true});
    }

    // Create fresh directory
    fs.mkdirSync(outputDir, {recursive: true});

    return outputDir;
}

/**
 * Apply CLI options on top of resolved config.
 * CLI options have the highest priority in the configuration hierarchy:
 * 1. CLI flags (highest)
 * 2. Environment variables
 * 3. Config file
 * 4. Built-in defaults (lowest)
 */
export function applyCliOverrides(
    config: ResolvedTestcontainersConfig,
    options: {
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
    },
): ResolvedTestcontainersConfig {
    const result = {
        ...config,
        server: {...config.server},
        images: {...config.images},
        admin: config.admin ? {...config.admin} : undefined,
    };

    // Server edition (CLI flag)
    if (options.edition) {
        const edition = options.edition.toLowerCase();
        if (edition === 'enterprise' || edition === 'fips' || edition === 'team') {
            result.server.edition = edition as MattermostEdition;
        }
    }

    // Server tag (CLI flag)
    if (options.tag) {
        result.server.tag = options.tag;
    }

    // Service environment (CLI flag)
    if (options.serviceEnv) {
        const env = options.serviceEnv.toLowerCase();
        if (env === 'test' || env === 'production' || env === 'dev') {
            result.server.serviceEnvironment = env as ServiceEnvironment;
        }
    }

    // Additional dependencies (CLI flag adds to existing; accepts comma-separated, space-separated, or both)
    if (options.deps) {
        const additionalDeps = options.deps
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        result.dependencies = [...new Set([...result.dependencies, ...additionalDeps])];
    }

    // Output directory (CLI flag)
    if (options.outputDir) {
        result.outputDir = options.outputDir;
    }

    // HA mode (CLI flag)
    if (options.ha !== undefined) {
        result.server.ha = options.ha;
    }

    // Subpath mode (CLI flag)
    if (options.subpath !== undefined) {
        result.server.subpath = options.subpath;
    }

    // Entry tier (CLI flag)
    if (options.entry) {
        result.server.entry = true;
    }

    // Admin user (CLI flag)
    if (options.admin !== undefined) {
        const username = typeof options.admin === 'string' ? options.admin : DEFAULT_ADMIN.username;
        result.admin = {
            username,
            password: options.adminPassword || result.admin?.password || DEFAULT_ADMIN.password,
            email: `${username}@sample.mattermost.com`,
        };
    }

    // Rebuild server image after applying overrides
    result.server.image = `${MATTERMOST_EDITION_IMAGES[result.server.edition]}:${result.server.tag}`;

    return result;
}

/**
 * Build server environment variables from config, env file, and CLI options.
 * Priority (highest to lowest): CLI -E options > --env-file > config file server.env
 */
export function buildServerEnv(
    config: ResolvedTestcontainersConfig,
    options: {env?: string[]; envFile?: string; serviceEnv?: string; depsOnly?: boolean},
): Record<string, string> {
    const serverEnv: Record<string, string> = {};

    // Layer 1: Config file server.env (lowest priority)
    if (config.server.env) {
        Object.assign(serverEnv, config.server.env);
    }

    // Layer 2: Env file (if provided)
    if (options.envFile) {
        if (!fs.existsSync(options.envFile)) {
            throw new Error(`Env file not found: ${options.envFile}`);
        }
        const envFileContent = fs.readFileSync(options.envFile, 'utf-8');
        const parsed = dotenv.parse(envFileContent);
        Object.assign(serverEnv, parsed);
    }

    // Layer 3: CLI -E options (highest priority)
    if (options.env) {
        for (const envVar of options.env) {
            const eqIndex = envVar.indexOf('=');
            if (eqIndex === -1) {
                throw new Error(`Invalid environment variable format: ${envVar}. Expected KEY=value`);
            }
            const key = envVar.substring(0, eqIndex);
            const value = envVar.substring(eqIndex + 1);
            serverEnv[key] = value;
        }
    }

    // Apply service environment with proper priority:
    // CLI -S option > CLI -E option > --env-file > config file > default based on mode
    if (options.serviceEnv) {
        serverEnv.MM_SERVICEENVIRONMENT = options.serviceEnv;
    } else if (!serverEnv.MM_SERVICEENVIRONMENT && config.server.serviceEnvironment) {
        serverEnv.MM_SERVICEENVIRONMENT = config.server.serviceEnvironment;
    } else if (!serverEnv.MM_SERVICEENVIRONMENT) {
        // Default based on mode: 'dev' for deps-only (local development), 'test' for container mode
        serverEnv.MM_SERVICEENVIRONMENT = options.depsOnly ? 'dev' : 'test';
    }

    return serverEnv;
}
