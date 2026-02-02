// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Centralized configuration for the Autonomous Testing CLI.
 *
 * Environment variables take precedence over defaults.
 * This allows configuration via CI/CD pipelines or local .env files.
 */

export const config = {
    /** Base URL for the Mattermost server */
    baseUrl: process.env.PW_BASE_URL || 'http://localhost:8065',

    /** Default login credentials */
    credentials: {
        username: process.env.MM_USERNAME || process.env.MATTERMOST_USERNAME || 'sysadmin',
        password: process.env.MM_PASSWORD || process.env.MATTERMOST_PASSWORD || 'Sys@dmin-sample1',
    },

    /** AI model configuration */
    ai: {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 8000,
        temperature: 0.2,
        healingTemperature: 0.1,
    },

    /** Default test generation settings */
    defaults: {
        scenarios: 5,
        outputDir: 'specs/functional/ai-assisted',
        browser: 'chrome' as const,
        maxHealAttempts: 3,
    },

    /** Exploration settings */
    exploration: {
        maxDepth: 2,
        parallelMaxDepth: 3,
        maxPages: 15,
        healingMaxPages: 5,
        healingMaxDepth: 1,
    },

    /** Timeouts in milliseconds */
    timeouts: {
        testRun: 300000, // 5 minutes
        navigation: 30000, // 30 seconds
        navigationShort: 15000, // 15 seconds
        elementTimeout: 1000, // 1 second
    },
} as const;

/**
 * Get base URL from args or config
 */
export function getBaseUrl(argsBaseUrl?: string): string {
    return argsBaseUrl || config.baseUrl;
}

/**
 * Get credentials from config
 */
export function getCredentials(): {username: string; password: string} {
    return {
        username: config.credentials.username,
        password: config.credentials.password,
    };
}
