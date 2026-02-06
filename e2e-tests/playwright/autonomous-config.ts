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

    /**
     * Generation settings (Phase 1-2: UI Map Infrastructure & Signal Gating)
     *
     * Controls quality gates for test generation based on UI discovery signal strength.
     * Signal strength determines whether to:
     * - Exit with error (<25% coverage)
     * - Draft feature spec (25-50%)
     * - Warn but continue (50-75%)
     * - Proceed normally (>=75%)
     */
    generation: {
        /**
         * Min confidence score for selectors (0-100)
         * Selectors below this threshold are not considered "whitelisted"
         *
         * Confidence calculation:
         * - testId: 100% (most reliable)
         * - ariaLabel: 85%
         * - text matching: 70%
         * - class selectors: 50%
         *
         * Recommended: 50 (balance between reliability and coverage)
         */
        minConfidenceThreshold: 50,

        /**
         * Min semantic types needed for generation
         * Semantic types: login_form, post_button, channel_link, etc.
         *
         * UI explorer groups selectors by semantic meaning.
         * Higher values require more diverse UI interactions.
         *
         * Recommended: 3 (ensure multiple element types discovered)
         */
        requiredSemantics: 3,

        /**
         * Min % of high-confidence selectors for valid signal (0-100)
         * Coverage = (high-confidence selectors) / (total selectors) * 100
         *
         * Signal quality:
         * - <25%: Insufficient (exit with guidance)
         * - 25-50%: Weak (draft spec for review)
         * - 50-75%: Moderate (warn, continue with caution)
         * - >=75%: Strong (proceed with confidence)
         *
         * Recommended: 75 (strong signal = robust tests)
         */
        minCoveragePercent: 75,
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
