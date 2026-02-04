import { StartedNetwork } from 'testcontainers';
import { DependencyConnectionInfo, ContainerMetadataMap, HAClusterConnectionInfo, SubpathConnectionInfo, PostgresConnectionInfo, InbucketConnectionInfo, OpenLdapConnectionInfo, MinioConnectionInfo, ElasticsearchConnectionInfo, OpenSearchConnectionInfo, KeycloakConnectionInfo, RedisConnectionInfo, MattermostConnectionInfo, DejavuConnectionInfo, PrometheusConnectionInfo, GrafanaConnectionInfo, LokiConnectionInfo, PromtailConnectionInfo } from '../config/types';
import { ResolvedTestcontainersConfig } from '../config/config';
import { MmctlClient } from './mmctl';
import { ServerMode } from './types';
export type { ServerMode };
export { formatElapsed } from './types';
export { httpPost, httpGet, httpPut, HttpResponse } from './http';
export { formatConfigValue, applyDefaultTestSettings, patchServerConfig, buildBaseEnvOverrides, configureServerViaMmctl, DEFAULT_TEST_SETTINGS, } from './server-config';
/**
 * MattermostTestEnvironment orchestrates all test containers for E2E testing.
 * It manages the lifecycle of containers and provides connection information.
 */
export declare class MattermostTestEnvironment {
    private config;
    private serverMode;
    private network;
    private postgresContainer;
    private inbucketContainer;
    private openldapContainer;
    private minioContainer;
    private elasticsearchContainer;
    private opensearchContainer;
    private keycloakContainer;
    private redisContainer;
    private dejavuContainer;
    private prometheusContainer;
    private grafanaContainer;
    private lokiContainer;
    private promtailContainer;
    private mattermostContainer;
    private nginxContainer;
    private mattermostNodes;
    private mattermostServer1;
    private mattermostServer2;
    private server1Nodes;
    private server2Nodes;
    private connectionInfo;
    /**
     * Create a new MattermostTestEnvironment.
     * @param config Resolved testcontainers configuration
     * @param serverMode Server mode: 'container' (default) or 'local'
     */
    constructor(config: ResolvedTestcontainersConfig, serverMode?: ServerMode);
    /**
     * Start all enabled dependencies and the Mattermost server.
     */
    start(): Promise<void>;
    private log;
    /**
     * Stop all running containers and clean up resources.
     */
    stop(): Promise<void>;
    /**
     * Get connection information for all dependencies.
     */
    getConnectionInfo(): DependencyConnectionInfo;
    /**
     * Print connection information for all dependencies to console.
     */
    printConnectionInfo(): void;
    /**
     * Get the MmctlClient for executing mmctl commands.
     * In HA mode, connects to the leader node.
     * In subpath mode, connects to server1 (leader node if HA).
     */
    getMmctl(): MmctlClient;
    /**
     * Get the Mattermost server URL.
     * In HA mode, returns the nginx load balancer URL.
     * In subpath mode, returns the nginx URL (use getSubpathInfo() for server-specific URLs).
     */
    getServerUrl(): string;
    /**
     * Get HA cluster connection info (only available in HA mode).
     */
    getHAClusterInfo(): HAClusterConnectionInfo | undefined;
    /**
     * Get subpath connection info (only available in subpath mode).
     */
    getSubpathInfo(): SubpathConnectionInfo | undefined;
    /**
     * Create admin user based on config.
     * Returns the admin credentials used.
     */
    createAdminUser(): Promise<{
        success: boolean;
        username?: string;
        password?: string;
        email?: string;
        error?: string;
    }>;
    getPostgresInfo(): PostgresConnectionInfo;
    getInbucketInfo(): InbucketConnectionInfo | undefined;
    getOpenLdapInfo(): OpenLdapConnectionInfo | undefined;
    getMinioInfo(): MinioConnectionInfo | undefined;
    getElasticsearchInfo(): ElasticsearchConnectionInfo | undefined;
    getOpenSearchInfo(): OpenSearchConnectionInfo | undefined;
    getKeycloakInfo(): KeycloakConnectionInfo | undefined;
    getRedisInfo(): RedisConnectionInfo | undefined;
    getMattermostInfo(): MattermostConnectionInfo | undefined;
    getDejavuInfo(): DejavuConnectionInfo | undefined;
    getPrometheusInfo(): PrometheusConnectionInfo | undefined;
    getGrafanaInfo(): GrafanaConnectionInfo | undefined;
    getLokiInfo(): LokiConnectionInfo | undefined;
    getPromtailInfo(): PromtailConnectionInfo | undefined;
    /**
     * Get the Docker network. Useful for adding custom containers to the network.
     */
    getNetwork(): StartedNetwork;
    /**
     * Extract metadata from a container.
     */
    private getContainerMetadataFrom;
    /**
     * Get metadata for all running containers.
     */
    getContainerMetadata(): ContainerMetadataMap;
    private startPostgres;
    private startInbucket;
    private startOpenLdap;
    private startMinio;
    private startElasticsearch;
    private startOpenSearch;
    private startKeycloak;
    private startRedis;
    private startDejavu;
    private startPrometheus;
    private startGrafana;
    private startLoki;
    private startPromtail;
    private startMattermost;
    /**
     * Start Mattermost in HA mode (multi-node cluster with nginx load balancer).
     */
    private startMattermostHA;
    /**
     * Start Mattermost in subpath mode (two servers behind nginx with /mattermost1 and /mattermost2).
     * Can be combined with HA mode for 6 total nodes (3 per server).
     */
    private startMattermostSubpath;
    /**
     * Create second database for subpath server2.
     */
    private createSubpathDatabase;
    /**
     * Build dependencies for subpath server.
     */
    private buildSubpathDeps;
    /**
     * Build base environment overrides for Mattermost containers.
     * Delegates to the standalone buildBaseEnvOverrides function.
     */
    private buildEnvOverrides;
    /**
     * Configure server via mmctl after it's running.
     * Delegates to the standalone configureServerViaMmctl function.
     */
    private configureServer;
    /**
     * Configure a subpath server via mmctl.
     */
    private configureSubpathServer;
    /**
     * Load LDAP test data (schemas and users) into the OpenLDAP container.
     * This mirrors what server/Makefile does in start-docker-openldap-test-data.
     */
    private loadLdapTestData;
    /**
     * Upload SAML IDP certificate and configure SAML settings for Keycloak.
     * This fully configures SAML authentication with Keycloak.
     * @returns Result object with success status and optional error message
     */
    uploadSamlIdpCertificate(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Configure SAML for a single Mattermost server.
     */
    private configureSamlForServer;
    /**
     * Get mmctl client for a specific server in subpath mode.
     */
    private getMmctlForServer;
    /**
     * Update Keycloak SAML client for subpath mode with both server URLs.
     */
    private updateKeycloakSamlClientForSubpath;
    /**
     * Update Keycloak SAML client configuration with the correct Mattermost URL.
     * This sets the proper rootUrl, redirectUris, and webOrigins instead of wildcards.
     */
    private updateKeycloakSamlClient;
}
