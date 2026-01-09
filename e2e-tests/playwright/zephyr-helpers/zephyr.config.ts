// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Zephyr Scale Cloud API Configuration
 *
 * Configure Zephyr Scale API v2 integration for test case management.
 *
 * Environment Variables Required:
 * - ZEPHYR_TOKEN: JWT token from Zephyr Scale with read/write permissions
 * - ZEPHYR_API_BASE_URL: (Optional) API base URL, defaults to https://api.zephyrscale.smartbear.com/v2
 * - ZEPHYR_PROJECT_KEY: Project key (default: MM for Mattermost)
 */

export interface ZephyrConfig {
    baseUrl: string;
    apiToken: string;
    projectKey: string;
    defaultPageSize: number;
    cacheTimeout: number;
    retryAttempts: number;
    retryDelay: number;
}

// Lazy-loaded config to ensure environment variables are available
let _zephyrConfig: ZephyrConfig | null = null;

export const zephyrConfig = (): ZephyrConfig => {
    if (!_zephyrConfig) {
        _zephyrConfig = {
            // Base URL for Zephyr Scale Cloud API v2
            // Default to Zephyr Scale API, or allow override for on-premise installations
            baseUrl: process.env.ZEPHYR_API_BASE_URL || 'https://api.zephyrscale.smartbear.com/v2',

            // API token for authentication (uses ZEPHYR_TOKEN from .env)
            apiToken: process.env.ZEPHYR_TOKEN || process.env.ZEPHYR_API_TOKEN || '',

            // Project key (MM for Mattermost)
            projectKey: process.env.ZEPHYR_PROJECT_KEY || 'MM',

            // Default page size for pagination
            defaultPageSize: 50,

            // Cache timeout in milliseconds (1 hour)
            cacheTimeout: 3600000,

            // Number of retry attempts for failed requests
            retryAttempts: 3,

            // Delay between retries in milliseconds
            retryDelay: 1000,
        };
    }
    return _zephyrConfig;
};

/**
 * Custom field IDs for Zephyr
 * Update these with your actual custom field IDs from Zephyr
 */
export const zephyrCustomFields = {
    // Playwright automation status field
    playwright: process.env.ZEPHYR_FIELD_PLAYWRIGHT || 'customfield_10001',

    // E2E test file path field
    e2eFilePath: process.env.ZEPHYR_FIELD_E2E_PATH || 'customfield_10002',

    // Automated date field
    automatedDate: process.env.ZEPHYR_FIELD_AUTOMATED_DATE || 'customfield_10003',

    // Automated by field
    automatedBy: process.env.ZEPHYR_FIELD_AUTOMATED_BY || 'customfield_10004',

    // Priority P1-P4 field
    priorityP1toP4: process.env.ZEPHYR_FIELD_PRIORITY_P1_P4 || 'customfield_10005',
};

/**
 * Validate Zephyr configuration
 * @throws Error if required configuration is missing
 */
export function validateZephyrConfig(): void {
    const config = zephyrConfig();

    if (!config.baseUrl) {
        throw new Error(
            'ZEPHYR_API_BASE_URL environment variable is required. ' +
                'Default: https://api.zephyrscale.smartbear.com/v2',
        );
    }

    if (!config.apiToken) {
        throw new Error(
            'ZEPHYR_TOKEN environment variable is required. ' + 'Use your Zephyr Scale JWT token from .env file.',
        );
    }

    if (!config.projectKey) {
        throw new Error('ZEPHYR_PROJECT_KEY environment variable is required. ' + 'Default: MM for Mattermost');
    }

    console.log('✅ Zephyr Scale Cloud API configuration validated successfully');
    console.log(`   API Base URL: ${config.baseUrl}`);
    console.log(`   Project: ${config.projectKey}`);
}
