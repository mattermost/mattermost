import { DependencyConnectionInfo } from '../config/types';
import { ResolvedTestcontainersConfig } from '../config/config';
import { MmctlClient } from './mmctl';
import { ServerMode } from './types';
/**
 * Default test settings applied via mmctl.
 * These settings can be changed in System Console (not locked by env vars).
 */
export declare const DEFAULT_TEST_SETTINGS: Record<string, string | boolean>;
/**
 * Format a config value for mmctl config set command.
 * - Strings: double-quoted (escaped internal quotes)
 * - Numbers/booleans: as-is (mmctl handles these)
 * - Arrays of strings: multiple double-quoted values
 * - Objects/complex: single-quoted JSON string
 */
export declare function formatConfigValue(value: unknown): string;
/**
 * Apply default test settings via mmctl.
 */
export declare function applyDefaultTestSettings(mmctl: MmctlClient, log: (message: string) => void): Promise<void>;
/**
 * Patch server configuration via mmctl.
 */
export declare function patchServerConfig(config: Record<string, unknown>, mmctl: MmctlClient, log: (message: string) => void): Promise<void>;
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
export declare function buildBaseEnvOverrides(connectionInfo: Partial<DependencyConnectionInfo>, config: ResolvedTestcontainersConfig, serverMode: ServerMode): Record<string, string>;
/**
 * Configure server via mmctl after it's running.
 * Handles default test settings, LDAP, Elasticsearch, Redis, and server config patch.
 */
export declare function configureServerViaMmctl(mmctl: MmctlClient, connectionInfo: Partial<DependencyConnectionInfo>, config: ResolvedTestcontainersConfig, log: (message: string) => void, loadLdapTestData: () => Promise<void>): Promise<void>;
