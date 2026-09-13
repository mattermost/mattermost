// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

import {DEFAULT_ADMIN, ESR_SERVER_TAG, getEditionImage} from '@/config';
import type {MattermostEdition, ResolvedTestcontainersConfig, ServiceEnvironment} from '@/config';

/**
 * Validate that an output directory path is safe for recursive deletion.
 * Rejects paths that could escape the current working directory.
 * @throws Error if the path is unsafe
 */
export function validateOutputDir(outputDir: string): void {
    const resolved = path.resolve(outputDir);
    const cwd = process.cwd();

    // Must be within or under the current working directory
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
        throw new Error(
            `Unsafe output directory: "${outputDir}" resolves to "${resolved}" which is outside the working directory "${cwd}". Use a relative path within your project.`,
        );
    }

    // Must not be the cwd itself (would delete the project)
    if (resolved === cwd) {
        throw new Error(`Output directory cannot be the current working directory.`);
    }
}

/**
 * Prepare output directory for a new session.
 * Deletes existing directory if present and creates it fresh.
 * Validates the path is safe before any destructive operations.
 *
 * @param outputDir Output directory path
 * @returns Path to the output directory
 */
export function prepareOutputDirectory(outputDir: string): string {
    validateOutputDir(outputDir);

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
        esr?: boolean;
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

    // ESR mode (CLI flag) — sets tag to current ESR version; -t can still override
    if (options.esr) {
        result.server.tag = ESR_SERVER_TAG;
    }

    // Server tag (CLI flag) — overrides --esr if both provided
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
    result.server.image = `${getEditionImage(result.server.edition, result.server.tag)}:${result.server.tag}`;

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
