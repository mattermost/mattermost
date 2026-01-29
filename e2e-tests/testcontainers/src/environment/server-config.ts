// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MmctlClient} from '../mmctl';
import {DependencyConnectionInfo} from '../config/types';
import {ResolvedTestcontainersConfig} from '../config/config';

import {ServerMode} from './types';

/**
 * Default test settings applied via mmctl.
 * These settings can be changed in System Console (not locked by env vars).
 */
export const DEFAULT_TEST_SETTINGS: Record<string, string | boolean> = {
    // Service settings
    'ServiceSettings.EnableLocalMode': true,
    'ServiceSettings.EnableTesting': true,
    'ServiceSettings.EnableDeveloper': true,
    'ServiceSettings.AllowCorsFrom': '*',
    'ServiceSettings.EnableSecurityFixAlert': false,
    // Note: ServiceEnvironment is set via env var only (not mmctl)
    // Note: ClusterSettings.ReadOnlyConfig is set via env var to avoid cluster instability warnings

    // Plugin settings
    'PluginSettings.EnableUploads': true,
    'PluginSettings.AutomaticPrepackagedPlugins': true,

    // Log settings
    'LogSettings.EnableConsole': true,
    'LogSettings.ConsoleLevel': 'DEBUG',
    'LogSettings.EnableDiagnostics': false,

    // Team settings
    'TeamSettings.EnableOpenServer': true,
    'TeamSettings.MaxUsersPerTeam': '10000',

    // Email settings (test defaults for inbucket)
    'EmailSettings.EnableSMTPAuth': false,
    'EmailSettings.SendEmailNotifications': true,
    'EmailSettings.FeedbackEmail': 'test@localhost.com',
    'EmailSettings.FeedbackName': 'Mattermost Test',
    'EmailSettings.ReplyToAddress': 'test@localhost.com',
};

/**
 * Format a config value for mmctl config set command.
 * - Strings: double-quoted (escaped internal quotes)
 * - Numbers/booleans: as-is (mmctl handles these)
 * - Arrays of strings: multiple double-quoted values
 * - Objects/complex: single-quoted JSON string
 */
export function formatConfigValue(value: unknown): string {
    if (typeof value === 'string') {
        // Double-quote strings, escape internal double quotes
        return `"${value.replace(/"/g, '\\"')}"`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        // Numbers and booleans can be passed directly
        return String(value);
    }

    if (Array.isArray(value)) {
        // Arrays of primitives: pass as multiple quoted arguments
        // e.g., mmctl config set Key "value1" "value2"
        if (value.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
            return value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(' ');
        }
        // Complex arrays: use JSON
        return `'${JSON.stringify(value)}'`;
    }

    if (typeof value === 'object' && value !== null) {
        // Objects: use single-quoted JSON string
        return `'${JSON.stringify(value)}'`;
    }

    // Fallback for null/undefined
    return '""';
}

/**
 * Apply default test settings via mmctl.
 */
export async function applyDefaultTestSettings(mmctl: MmctlClient, log: (message: string) => void): Promise<void> {
    for (const [key, value] of Object.entries(DEFAULT_TEST_SETTINGS)) {
        const formattedValue = formatConfigValue(value);
        const result = await mmctl.exec(`config set ${key} ${formattedValue}`);
        if (result.exitCode !== 0) {
            log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
        }
    }
}

/**
 * Patch server configuration via mmctl.
 */
export async function patchServerConfig(
    config: Record<string, unknown>,
    mmctl: MmctlClient,
    log: (message: string) => void,
): Promise<void> {
    log('Patching server configuration via mmctl');

    for (const [section, settings] of Object.entries(config)) {
        if (typeof settings === 'object' && settings !== null) {
            for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
                const configKey = `${section}.${key}`;
                const configValue = formatConfigValue(value);

                const result = await mmctl.exec(`config set ${configKey} ${configValue}`);
                if (result.exitCode !== 0) {
                    log(`⚠ Failed to set ${configKey}: ${result.stdout || result.stderr}`);
                }
            }
        }
    }

    log('✓ Server configuration patched');
}

/**
 * Build base environment overrides for Mattermost containers.
 * Handles dependency-specific settings, service environment, MM_* passthrough, and user config.
 *
 * Priority (lowest to highest):
 * 1. Dependency-specific env vars (minio, elasticsearch, opensearch, redis)
 * 2. MM_SERVICEENVIRONMENT based on serverMode
 * 3. MM_* environment variables from host (includes MM_LICENSE)
 * 4. User-provided server.env from config
 *
 * Note: MM_SERVICESETTINGS_SITEURL is always excluded - it's set via mmctl after startup.
 * Note: MM_LICENSE cannot be set in config file - must come from environment variable.
 */
export function buildBaseEnvOverrides(
    connectionInfo: Partial<DependencyConnectionInfo>,
    config: ResolvedTestcontainersConfig,
    serverMode: ServerMode,
): Record<string, string> {
    const envOverrides: Record<string, string> = {};

    // Dependency-specific environment variables
    if (connectionInfo.minio) {
        envOverrides.MM_FILESETTINGS_DRIVERNAME = 'amazons3';
        envOverrides.MM_FILESETTINGS_AMAZONS3ACCESSKEYID = connectionInfo.minio.accessKey;
        envOverrides.MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY = connectionInfo.minio.secretKey;
        envOverrides.MM_FILESETTINGS_AMAZONS3BUCKET = 'mattermost-test';
        envOverrides.MM_FILESETTINGS_AMAZONS3ENDPOINT = 'minio:9000';
        envOverrides.MM_FILESETTINGS_AMAZONS3SSL = 'false';
    }

    if (connectionInfo.elasticsearch) {
        // Note: EnableIndexing/EnableSearching are set via mmctl after startup
        envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://elasticsearch:9200';
    }

    if (connectionInfo.opensearch) {
        // Note: EnableIndexing/EnableSearching are set via mmctl after startup
        envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://opensearch:9200';
        envOverrides.MM_ELASTICSEARCHSETTINGS_BACKEND = 'opensearch';
    }

    if (connectionInfo.redis) {
        // Note: CacheType is set via mmctl after startup
        envOverrides.MM_CACHESETTINGS_REDISADDRESS = 'redis:6379';
        envOverrides.MM_CACHESETTINGS_REDISDB = '0';
    }

    // Set default MM_SERVICEENVIRONMENT based on serverMode
    // 'test' for container mode, 'dev' for local mode
    const defaultServiceEnv = serverMode === 'local' ? 'dev' : 'test';
    envOverrides.MM_SERVICEENVIRONMENT = config.server.serviceEnvironment || defaultServiceEnv;

    // Pass all MM_* environment variables from host (includes MM_LICENSE)
    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('MM_') && key !== 'MM_SERVICESETTINGS_SITEURL' && value !== undefined) {
            envOverrides[key] = value;
        }
    }

    // Apply user-provided server environment variables (highest priority)
    // Excluded: MM_SERVICESETTINGS_SITEURL (set via mmctl after startup)
    // Forbidden: MM_LICENSE (must come from env var only to prevent leaks in config files)
    if (config.server.env) {
        if (config.server.env.MM_LICENSE) {
            throw new Error('MM_LICENSE cannot be set in config file (server.env)');
        }
        const {MM_SERVICESETTINGS_SITEURL: _siteUrl, ...restEnv} = config.server.env;
        void _siteUrl; // Intentionally excluded - SiteURL is set via mmctl after startup
        Object.assign(envOverrides, restEnv);
    }

    return envOverrides;
}

/**
 * Configure server via mmctl after it's running.
 * Handles default test settings, LDAP, Elasticsearch, Redis, and server config patch.
 */
export async function configureServerViaMmctl(
    mmctl: MmctlClient,
    connectionInfo: Partial<DependencyConnectionInfo>,
    config: ResolvedTestcontainersConfig,
    log: (message: string) => void,
    loadLdapTestData: () => Promise<void>,
): Promise<void> {
    // Apply default test settings
    await applyDefaultTestSettings(mmctl, log);

    // Configure LDAP settings if openldap is connected (via mmctl so they persist in DB)
    if (connectionInfo.openldap) {
        const ldapAttributes: Record<string, string> = {
            'LdapSettings.LdapServer': 'openldap',
            'LdapSettings.LdapPort': '389',
            'LdapSettings.BaseDN': connectionInfo.openldap.baseDN,
            'LdapSettings.BindUsername': connectionInfo.openldap.bindDN,
            'LdapSettings.BindPassword': connectionInfo.openldap.bindPassword,
            'LdapSettings.EmailAttribute': 'mail',
            'LdapSettings.UsernameAttribute': 'uid',
            'LdapSettings.IdAttribute': 'uid',
            'LdapSettings.LoginIdAttribute': 'uid',
            'LdapSettings.FirstNameAttribute': 'cn',
            'LdapSettings.LastNameAttribute': 'sn',
            'LdapSettings.NicknameAttribute': 'cn',
            'LdapSettings.PositionAttribute': 'title',
            'LdapSettings.GroupDisplayNameAttribute': 'cn',
            'LdapSettings.GroupIdAttribute': 'entryUUID',
        };
        for (const [key, value] of Object.entries(ldapAttributes)) {
            const result = await mmctl.exec(`config set ${key} "${value}"`);
            if (result.exitCode !== 0) {
                log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
            }
        }
        // Now enable LDAP
        const ldapResult = await mmctl.exec('config set LdapSettings.Enable true');
        if (ldapResult.exitCode !== 0) {
            log(`⚠ Failed to enable LDAP: ${ldapResult.stdout || ldapResult.stderr}`);
        }

        // Load LDAP test data
        await loadLdapTestData();
    }

    // Enable Elasticsearch/OpenSearch if configured (via mmctl so it can be changed in System Console)
    if (connectionInfo.elasticsearch || connectionInfo.opensearch) {
        const indexingResult = await mmctl.exec('config set ElasticsearchSettings.EnableIndexing true');
        if (indexingResult.exitCode !== 0) {
            log(`⚠ Failed to enable Elasticsearch indexing: ${indexingResult.stdout || indexingResult.stderr}`);
        }
        const searchingResult = await mmctl.exec('config set ElasticsearchSettings.EnableSearching true');
        if (searchingResult.exitCode !== 0) {
            log(`⚠ Failed to enable Elasticsearch searching: ${searchingResult.stdout || searchingResult.stderr}`);
        }
    }

    // Enable Redis cache if configured (via mmctl so it can be changed in System Console)
    if (connectionInfo.redis) {
        const redisResult = await mmctl.exec('config set CacheSettings.CacheType redis');
        if (redisResult.exitCode !== 0) {
            log(`⚠ Failed to set Redis cache type: ${redisResult.stdout || redisResult.stderr}`);
        }
    }

    // Note: Keycloak SAML and OpenID settings are NOT pre-configured automatically
    // because SAML requires certificate upload which doesn't work with database config.
    // Users can configure SAML/OpenID manually via System Console or server.config in mm-tc.config.mjs.
    // The Keycloak container has pre-configured clients: 'mattermost' (SAML) and 'mattermost-openid' (OpenID).
    // See .env.tc output for example settings when keycloak is enabled.

    // Apply server config patch via mmctl if provided (overrides defaults)
    if (config.server.config) {
        await patchServerConfig(config.server.config, mmctl, log);
    }
}
