// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Disable Ryuk (testcontainers cleanup container) so containers persist after CLI exits.
// Containers should only be cleaned up via `mm-tc stop`.
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

import http, {IncomingMessage} from 'http';

import {Network, StartedNetwork, StartedTestContainer} from 'testcontainers';
import {StartedPostgreSqlContainer} from '@testcontainers/postgresql';

import {
    EnvironmentConfig,
    DependencyConnectionInfo,
    PostgresConnectionInfo,
    InbucketConnectionInfo,
    OpenLdapConnectionInfo,
    MinioConnectionInfo,
    ElasticsearchConnectionInfo,
    OpenSearchConnectionInfo,
    KeycloakConnectionInfo,
    RedisConnectionInfo,
    MattermostConnectionInfo,
    MattermostNodeConnectionInfo,
    HAClusterConnectionInfo,
    SubpathConnectionInfo,
    DejavuConnectionInfo,
    PrometheusConnectionInfo,
    GrafanaConnectionInfo,
    LokiConnectionInfo,
    PromtailConnectionInfo,
    ContainerMetadata,
    ContainerMetadataMap,
} from './config/types';
import {createPostgresContainer, getPostgresConnectionInfo} from './containers/postgres';
import {createInbucketContainer, getInbucketConnectionInfo} from './containers/inbucket';
import {createOpenLdapContainer, getOpenLdapConnectionInfo} from './containers/openldap';
import {createMinioContainer, getMinioConnectionInfo} from './containers/minio';
import {createElasticsearchContainer, getElasticsearchConnectionInfo} from './containers/elasticsearch';
import {createOpenSearchContainer, getOpenSearchConnectionInfo} from './containers/opensearch';
import {createKeycloakContainer, getKeycloakConnectionInfo} from './containers/keycloak';
import {createRedisContainer, getRedisConnectionInfo} from './containers/redis';
import {createDejavuContainer, getDejavuConnectionInfo} from './containers/dejavu';
import {createPrometheusContainer, getPrometheusConnectionInfo} from './containers/prometheus';
import {createGrafanaContainer, getGrafanaConnectionInfo} from './containers/grafana';
import {createLokiContainer, getLokiConnectionInfo} from './containers/loki';
import {createPromtailContainer, getPromtailConnectionInfo} from './containers/promtail';
import {
    createMattermostContainer,
    getMattermostConnectionInfo,
    getMattermostNodeConnectionInfo,
    generateNodeNames,
    MattermostDependencies,
} from './containers/mattermost';
import {createNginxContainer, createSubpathNginxContainer, getNginxConnectionInfo} from './containers/nginx';
import {
    getMattermostImage,
    getPostgresImage,
    getInbucketImage,
    getOpenLdapImage,
    getMinioImage,
    getElasticsearchImage,
    getOpenSearchImage,
    getKeycloakImage,
    getRedisImage,
    getDejavuImage,
    getPrometheusImage,
    getGrafanaImage,
    getLokiImage,
    getPromtailImage,
    getNginxImage,
    DEFAULT_HA_SETTINGS,
    HA_NODE_COUNT,
    INTERNAL_PORTS,
} from './config/defaults';
import {MmctlClient} from './mmctl';
import {imageExistsLocally} from './utils/docker';

const DEFAULT_DEPENDENCIES = ['postgres', 'inbucket'];

/**
 * Format elapsed time in a human-readable format.
 * Shows decimal if < 10s, whole seconds if < 60s, otherwise minutes and seconds.
 */
function formatElapsed(ms: number): string {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 10) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    if (totalSeconds < 60) {
        return `${Math.round(totalSeconds)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
}

/**
 * MattermostTestEnvironment orchestrates all test containers for E2E testing.
 * It manages the lifecycle of containers and provides connection information.
 */
export class MattermostTestEnvironment {
    private config: EnvironmentConfig;
    private network: StartedNetwork | null = null;

    // Container references
    private postgresContainer: StartedPostgreSqlContainer | null = null;
    private inbucketContainer: StartedTestContainer | null = null;
    private openldapContainer: StartedTestContainer | null = null;
    private minioContainer: StartedTestContainer | null = null;
    private elasticsearchContainer: StartedTestContainer | null = null;
    private opensearchContainer: StartedTestContainer | null = null;
    private keycloakContainer: StartedTestContainer | null = null;
    private redisContainer: StartedTestContainer | null = null;
    private dejavuContainer: StartedTestContainer | null = null;
    private prometheusContainer: StartedTestContainer | null = null;
    private grafanaContainer: StartedTestContainer | null = null;
    private lokiContainer: StartedTestContainer | null = null;
    private promtailContainer: StartedTestContainer | null = null;
    private mattermostContainer: StartedTestContainer | null = null;

    // HA mode containers
    private nginxContainer: StartedTestContainer | null = null;
    private mattermostNodes: Map<string, StartedTestContainer> = new Map();

    // Subpath mode containers
    private mattermostServer1: StartedTestContainer | null = null;
    private mattermostServer2: StartedTestContainer | null = null;
    // For subpath + HA mode
    private server1Nodes: Map<string, StartedTestContainer> = new Map();
    private server2Nodes: Map<string, StartedTestContainer> = new Map();

    // Connection info cache
    private connectionInfo: Partial<DependencyConnectionInfo> = {};

    constructor(config: EnvironmentConfig = {}) {
        this.config = {
            serverMode: 'container',
            dependencies: DEFAULT_DEPENDENCIES,
            ...config,
        };
    }

    /**
     * Start all enabled dependencies and the Mattermost server.
     */
    async start(): Promise<void> {
        const startTime = Date.now();
        if (this.config.serverMode === 'local') {
            this.log('Starting Mattermost dependencies');
        } else {
            this.log('Starting Mattermost test environment');
        }

        // Create network
        this.log('Creating Docker network');
        try {
            this.network = await new Network().start();
        } catch (error) {
            if (error instanceof Error && error.message.includes('Could not find a working container runtime')) {
                throw new Error('Docker is not running. Please start Docker and try again.');
            }
            throw error;
        }
        this.log('Network created');

        // Start dependencies in order
        // Ensure required dependencies (postgres, inbucket) are always included
        const REQUIRED_DEPS = ['postgres', 'inbucket'];
        const configuredDeps = this.config.dependencies ?? DEFAULT_DEPENDENCIES;
        const dependencies = [...new Set([...REQUIRED_DEPS, ...configuredDeps])];
        this.log(`Enabled dependencies: ${dependencies.join(', ')}`);

        // Validate: only one search engine can be enabled at a time
        const hasElasticsearch = dependencies.includes('elasticsearch');
        const hasOpensearch = dependencies.includes('opensearch');
        if (hasElasticsearch && hasOpensearch) {
            throw new Error(
                'Cannot enable both elasticsearch and opensearch. Only one search engine can be used at a time.',
            );
        }

        // Validate: dejavu requires a search engine (elasticsearch or opensearch)
        const hasDejavu = dependencies.includes('dejavu');
        if (hasDejavu && !hasElasticsearch && !hasOpensearch) {
            throw new Error(
                'Cannot enable dejavu without a search engine. Enable elasticsearch or opensearch with dejavu.',
            );
        }

        // Validate: promtail and loki must be enabled together
        const hasLoki = dependencies.includes('loki');
        const hasPromtail = dependencies.includes('promtail');
        if (hasPromtail && !hasLoki) {
            throw new Error('Cannot enable promtail without loki. Promtail requires Loki to send logs to.');
        }
        if (hasLoki && !hasPromtail) {
            throw new Error('Cannot enable loki without promtail. Enable both for log aggregation: -D loki,promtail');
        }

        // Validate: grafana requires at least one data source (prometheus or loki)
        const hasGrafana = dependencies.includes('grafana');
        const hasPrometheus = dependencies.includes('prometheus');
        if (hasGrafana && !hasPrometheus && !hasLoki) {
            throw new Error(
                'Cannot enable grafana without a data source. Enable prometheus and/or loki,promtail with grafana.',
            );
        }

        // Validate: redis requires a license with clustering support
        const hasRedis = dependencies.includes('redis');
        if (hasRedis && !process.env.MM_LICENSE) {
            throw new Error(
                'Cannot enable redis without MM_LICENSE. Redis requires a Mattermost license with clustering support.',
            );
        }

        // Validate: HA mode requires a license with clustering support
        if (this.config.ha && !process.env.MM_LICENSE) {
            throw new Error(
                'Cannot enable HA mode without MM_LICENSE. HA mode requires a Mattermost license with clustering support.',
            );
        }

        // Start all dependencies in parallel (Mattermost will wait for postgres)
        const parallelDeps: Promise<void>[] = [];
        const pendingDeps = new Set<string>();
        const depsStartTime = Date.now();

        // Log progress every 5 seconds while dependencies are starting
        const progressInterval = setInterval(() => {
            if (pendingDeps.size > 0) {
                const elapsed = formatElapsed(Date.now() - depsStartTime);
                this.log(`Still starting: ${[...pendingDeps].join(', ')} (${elapsed})`);
            }
        }, 5000);

        const wrapService = (
            name: string,
            image: string,
            startFn: () => Promise<void>,
            getReadyMessage: () => string,
        ) => {
            const serviceStartTime = Date.now();
            const needsPull = !imageExistsLocally(image);
            if (needsPull) {
                this.log(`Pulling image ${image}`);
            }
            pendingDeps.add(name);
            return startFn().then(() => {
                pendingDeps.delete(name);
                const elapsed = formatElapsed(Date.now() - serviceStartTime);
                this.log(`✓ ${getReadyMessage()} (${elapsed})`);
            });
        };

        if (dependencies.includes('postgres')) {
            const image = getPostgresImage();
            parallelDeps.push(
                wrapService(
                    'postgres',
                    image,
                    () => this.startPostgres(),
                    () => `PostgreSQL ready on port ${this.connectionInfo.postgres?.port}`,
                ),
            );
        }
        if (dependencies.includes('inbucket')) {
            const image = getInbucketImage();
            parallelDeps.push(
                wrapService(
                    'inbucket',
                    image,
                    () => this.startInbucket(),
                    () => `Inbucket ready on port ${this.connectionInfo.inbucket?.webPort}`,
                ),
            );
        }
        if (dependencies.includes('openldap')) {
            const image = getOpenLdapImage();
            parallelDeps.push(
                wrapService(
                    'openldap',
                    image,
                    () => this.startOpenLdap(),
                    () => `OpenLDAP ready on port ${this.connectionInfo.openldap?.port}`,
                ),
            );
        }
        if (dependencies.includes('minio')) {
            const image = getMinioImage();
            parallelDeps.push(
                wrapService(
                    'minio',
                    image,
                    () => this.startMinio(),
                    () => `MinIO ready on port ${this.connectionInfo.minio?.port}`,
                ),
            );
        }
        if (dependencies.includes('elasticsearch')) {
            const image = getElasticsearchImage();
            parallelDeps.push(
                wrapService(
                    'elasticsearch',
                    image,
                    () => this.startElasticsearch(),
                    () => `Elasticsearch ready on port ${this.connectionInfo.elasticsearch?.port}`,
                ),
            );
        }
        if (dependencies.includes('opensearch')) {
            const image = getOpenSearchImage();
            parallelDeps.push(
                wrapService(
                    'opensearch',
                    image,
                    () => this.startOpenSearch(),
                    () => `OpenSearch ready on port ${this.connectionInfo.opensearch?.port}`,
                ),
            );
        }
        if (dependencies.includes('keycloak')) {
            const image = getKeycloakImage();
            parallelDeps.push(
                wrapService(
                    'keycloak',
                    image,
                    () => this.startKeycloak(),
                    () => `Keycloak ready on port ${this.connectionInfo.keycloak?.port}`,
                ),
            );
        }
        if (dependencies.includes('redis')) {
            const image = getRedisImage();
            parallelDeps.push(
                wrapService(
                    'redis',
                    image,
                    () => this.startRedis(),
                    () => `Redis ready on port ${this.connectionInfo.redis?.port}`,
                ),
            );
        }
        if (dependencies.includes('dejavu')) {
            const image = getDejavuImage();
            parallelDeps.push(
                wrapService(
                    'dejavu',
                    image,
                    () => this.startDejavu(),
                    () => `Dejavu ready on port ${this.connectionInfo.dejavu?.port}`,
                ),
            );
        }
        if (dependencies.includes('prometheus')) {
            const image = getPrometheusImage();
            parallelDeps.push(
                wrapService(
                    'prometheus',
                    image,
                    () => this.startPrometheus(),
                    () => `Prometheus ready on port ${this.connectionInfo.prometheus?.port}`,
                ),
            );
        }
        if (dependencies.includes('grafana')) {
            const image = getGrafanaImage();
            parallelDeps.push(
                wrapService(
                    'grafana',
                    image,
                    () => this.startGrafana(),
                    () => `Grafana ready on port ${this.connectionInfo.grafana?.port}`,
                ),
            );
        }
        if (dependencies.includes('loki')) {
            const image = getLokiImage();
            parallelDeps.push(
                wrapService(
                    'loki',
                    image,
                    () => this.startLoki(),
                    () => `Loki ready on port ${this.connectionInfo.loki?.port}`,
                ),
            );
        }
        if (dependencies.includes('promtail')) {
            const image = getPromtailImage();
            parallelDeps.push(
                wrapService(
                    'promtail',
                    image,
                    () => this.startPromtail(),
                    () => `Promtail ready on port ${this.connectionInfo.promtail?.port}`,
                ),
            );
        }

        if (parallelDeps.length > 0) {
            this.log(`Starting dependencies: ${dependencies.join(', ')}`);
            await Promise.all(parallelDeps);
        }

        clearInterval(progressInterval);

        // Start Mattermost server (depends on postgres and optionally inbucket)
        if (this.config.serverMode === 'container') {
            if (this.config.subpath) {
                // Subpath mode: two servers behind nginx with /mattermost1 and /mattermost2
                // Can be combined with HA mode (6 total nodes)
                await this.startMattermostSubpath();
            } else if (this.config.ha) {
                // HA mode: start multiple nodes + nginx load balancer
                await this.startMattermostHA();
            } else {
                // Single node mode
                await this.startMattermost();
            }
        }

        const elapsed = formatElapsed(Date.now() - startTime);
        this.log(`✓ Test environment ready in ${elapsed}`);
    }

    private log(message: string): void {
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        // Use stderr for more reliable output visibility
        process.stderr.write(`[${timestamp}] [tc] ${message}\n`);
    }

    /**
     * Stop all running containers and clean up resources.
     */
    async stop(): Promise<void> {
        this.log('Stopping Mattermost test environment');

        const stopPromises: Promise<void>[] = [];

        // Stop nginx load balancer first (HA mode)
        if (this.nginxContainer) {
            stopPromises.push(this.nginxContainer.stop().then(() => this.log('Nginx stopped')));
        }

        // Stop HA cluster nodes
        for (const [nodeName, container] of this.mattermostNodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost ${nodeName} stopped`)));
        }

        // Stop subpath mode containers
        if (this.mattermostServer1) {
            stopPromises.push(this.mattermostServer1.stop().then(() => this.log('Mattermost server1 stopped')));
        }
        if (this.mattermostServer2) {
            stopPromises.push(this.mattermostServer2.stop().then(() => this.log('Mattermost server2 stopped')));
        }
        for (const [nodeName, container] of this.server1Nodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost server1-${nodeName} stopped`)));
        }
        for (const [nodeName, container] of this.server2Nodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost server2-${nodeName} stopped`)));
        }

        // Stop containers in reverse order
        if (this.mattermostContainer) {
            stopPromises.push(this.mattermostContainer.stop().then(() => this.log('Mattermost stopped')));
        }
        if (this.promtailContainer) {
            stopPromises.push(this.promtailContainer.stop().then(() => this.log('Promtail stopped')));
        }
        if (this.lokiContainer) {
            stopPromises.push(this.lokiContainer.stop().then(() => this.log('Loki stopped')));
        }
        if (this.grafanaContainer) {
            stopPromises.push(this.grafanaContainer.stop().then(() => this.log('Grafana stopped')));
        }
        if (this.prometheusContainer) {
            stopPromises.push(this.prometheusContainer.stop().then(() => this.log('Prometheus stopped')));
        }
        if (this.dejavuContainer) {
            stopPromises.push(this.dejavuContainer.stop().then(() => this.log('Dejavu stopped')));
        }
        if (this.redisContainer) {
            stopPromises.push(this.redisContainer.stop().then(() => this.log('Redis stopped')));
        }
        if (this.keycloakContainer) {
            stopPromises.push(this.keycloakContainer.stop().then(() => this.log('Keycloak stopped')));
        }
        if (this.elasticsearchContainer) {
            stopPromises.push(this.elasticsearchContainer.stop().then(() => this.log('Elasticsearch stopped')));
        }
        if (this.opensearchContainer) {
            stopPromises.push(this.opensearchContainer.stop().then(() => this.log('OpenSearch stopped')));
        }
        if (this.minioContainer) {
            stopPromises.push(this.minioContainer.stop().then(() => this.log('MinIO stopped')));
        }
        if (this.openldapContainer) {
            stopPromises.push(this.openldapContainer.stop().then(() => this.log('OpenLDAP stopped')));
        }
        if (this.inbucketContainer) {
            stopPromises.push(this.inbucketContainer.stop().then(() => this.log('Inbucket stopped')));
        }
        if (this.postgresContainer) {
            stopPromises.push(this.postgresContainer.stop().then(() => this.log('PostgreSQL stopped')));
        }

        await Promise.all(stopPromises);

        // Stop network
        if (this.network) {
            await this.network.stop();
            this.log('Network stopped');
        }

        // Clear state
        this.postgresContainer = null;
        this.inbucketContainer = null;
        this.openldapContainer = null;
        this.minioContainer = null;
        this.elasticsearchContainer = null;
        this.opensearchContainer = null;
        this.keycloakContainer = null;
        this.redisContainer = null;
        this.dejavuContainer = null;
        this.prometheusContainer = null;
        this.grafanaContainer = null;
        this.lokiContainer = null;
        this.promtailContainer = null;
        this.mattermostContainer = null;
        this.nginxContainer = null;
        this.mattermostNodes.clear();
        this.mattermostServer1 = null;
        this.mattermostServer2 = null;
        this.server1Nodes.clear();
        this.server2Nodes.clear();
        this.network = null;
        this.connectionInfo = {};

        this.log('Mattermost test environment stopped');
    }

    /**
     * Get connection information for all dependencies.
     */
    getConnectionInfo(): DependencyConnectionInfo {
        if (!this.connectionInfo.postgres) {
            throw new Error('Environment not started. Call start() first.');
        }
        return this.connectionInfo as DependencyConnectionInfo;
    }

    /**
     * Get the MmctlClient for executing mmctl commands.
     * In HA mode, connects to the leader node.
     * In subpath mode, connects to server1 (leader node if HA).
     */
    getMmctl(): MmctlClient {
        // In subpath mode, use server1
        if (this.config.subpath) {
            // Subpath + HA mode: use server1 leader
            const server1Leader = this.server1Nodes.get('leader');
            if (server1Leader) {
                return new MmctlClient(server1Leader);
            }
            // Subpath single node mode: use server1
            if (this.mattermostServer1) {
                return new MmctlClient(this.mattermostServer1);
            }
        }

        // In HA mode, use the leader node
        const leaderContainer = this.mattermostNodes.get('leader');
        if (leaderContainer) {
            return new MmctlClient(leaderContainer);
        }

        // Single node mode
        if (!this.mattermostContainer) {
            throw new Error('Mattermost container not running. Start with serverMode: "container".');
        }
        return new MmctlClient(this.mattermostContainer);
    }

    /**
     * Get the Mattermost server URL.
     * In HA mode, returns the nginx load balancer URL.
     * In subpath mode, returns the nginx URL (use getSubpathInfo() for server-specific URLs).
     */
    getServerUrl(): string {
        if (this.config.serverMode === 'local') {
            return 'http://localhost:8065';
        }
        // In subpath mode, return the load balancer URL
        if (this.connectionInfo.subpath) {
            return this.connectionInfo.subpath.url;
        }
        // In HA mode, return the load balancer URL
        if (this.connectionInfo.haCluster) {
            return this.connectionInfo.haCluster.url;
        }
        if (!this.connectionInfo.mattermost) {
            throw new Error('Mattermost not running');
        }
        return this.connectionInfo.mattermost.url;
    }

    /**
     * Get HA cluster connection info (only available in HA mode).
     */
    getHAClusterInfo(): HAClusterConnectionInfo | undefined {
        return this.connectionInfo.haCluster;
    }

    /**
     * Get subpath connection info (only available in subpath mode).
     */
    getSubpathInfo(): SubpathConnectionInfo | undefined {
        return this.connectionInfo.subpath;
    }

    /**
     * Create admin user based on config.
     * Returns the admin credentials used.
     */
    async createAdminUser(): Promise<{
        success: boolean;
        username?: string;
        password?: string;
        email?: string;
        error?: string;
    }> {
        if (!this.config.admin) {
            return {success: false, error: 'Admin config not provided'};
        }

        const mmctl = this.getMmctl();
        const username = this.config.admin.username;
        const password = this.config.admin.password || 'Sys@dmin-sample1';
        const email = `${username}@sample.mattermost.com`;

        // Create user via mmctl (local mode, no auth needed)
        // Ignore error if user already exists
        const createResult = await mmctl.exec(
            `user create --email "${email}" --username "${username}" --password "${password}" --system-admin`,
        );

        if (createResult.exitCode !== 0 && !createResult.stdout.includes('already exists')) {
            this.log(`⚠ Failed to create admin user: ${createResult.stdout || createResult.stderr}`);
            return {success: false, error: `Failed to create admin user: ${createResult.stdout}`};
        }

        this.log(`✓ Admin user created: ${username} / ${password} (${email})`);
        return {success: true, username, password, email};
    }

    // Individual service getters for more granular access
    getPostgresInfo(): PostgresConnectionInfo {
        if (!this.connectionInfo.postgres) {
            throw new Error('PostgreSQL not running');
        }
        return this.connectionInfo.postgres;
    }

    getInbucketInfo(): InbucketConnectionInfo | undefined {
        return this.connectionInfo.inbucket;
    }

    getOpenLdapInfo(): OpenLdapConnectionInfo | undefined {
        return this.connectionInfo.openldap;
    }

    getMinioInfo(): MinioConnectionInfo | undefined {
        return this.connectionInfo.minio;
    }

    getElasticsearchInfo(): ElasticsearchConnectionInfo | undefined {
        return this.connectionInfo.elasticsearch;
    }

    getOpenSearchInfo(): OpenSearchConnectionInfo | undefined {
        return this.connectionInfo.opensearch;
    }

    getKeycloakInfo(): KeycloakConnectionInfo | undefined {
        return this.connectionInfo.keycloak;
    }

    getRedisInfo(): RedisConnectionInfo | undefined {
        return this.connectionInfo.redis;
    }

    getMattermostInfo(): MattermostConnectionInfo | undefined {
        return this.connectionInfo.mattermost;
    }

    getDejavuInfo(): DejavuConnectionInfo | undefined {
        return this.connectionInfo.dejavu;
    }

    getPrometheusInfo(): PrometheusConnectionInfo | undefined {
        return this.connectionInfo.prometheus;
    }

    getGrafanaInfo(): GrafanaConnectionInfo | undefined {
        return this.connectionInfo.grafana;
    }

    getLokiInfo(): LokiConnectionInfo | undefined {
        return this.connectionInfo.loki;
    }

    getPromtailInfo(): PromtailConnectionInfo | undefined {
        return this.connectionInfo.promtail;
    }

    /**
     * Get the Docker network. Useful for adding custom containers to the network.
     */
    getNetwork(): StartedNetwork {
        if (!this.network) {
            throw new Error('Network not initialized. Call start() first.');
        }
        return this.network;
    }

    /**
     * Extract metadata from a container.
     */
    private getContainerMetadataFrom(
        container: StartedTestContainer | StartedPostgreSqlContainer | null,
        image: string,
    ): ContainerMetadata | undefined {
        if (!container) return undefined;
        return {
            id: container.getId(),
            name: container.getName(),
            image,
            labels: container.getLabels(),
        };
    }

    /**
     * Get metadata for all running containers.
     */
    getContainerMetadata(): ContainerMetadataMap {
        const metadata: ContainerMetadataMap = {};

        if (this.postgresContainer && this.connectionInfo.postgres) {
            metadata.postgres = this.getContainerMetadataFrom(
                this.postgresContainer,
                this.connectionInfo.postgres.image,
            );
        }
        if (this.inbucketContainer && this.connectionInfo.inbucket) {
            metadata.inbucket = this.getContainerMetadataFrom(
                this.inbucketContainer,
                this.connectionInfo.inbucket.image,
            );
        }
        if (this.openldapContainer && this.connectionInfo.openldap) {
            metadata.openldap = this.getContainerMetadataFrom(
                this.openldapContainer,
                this.connectionInfo.openldap.image,
            );
        }
        if (this.minioContainer && this.connectionInfo.minio) {
            metadata.minio = this.getContainerMetadataFrom(this.minioContainer, this.connectionInfo.minio.image);
        }
        if (this.elasticsearchContainer && this.connectionInfo.elasticsearch) {
            metadata.elasticsearch = this.getContainerMetadataFrom(
                this.elasticsearchContainer,
                this.connectionInfo.elasticsearch.image,
            );
        }
        if (this.opensearchContainer && this.connectionInfo.opensearch) {
            metadata.opensearch = this.getContainerMetadataFrom(
                this.opensearchContainer,
                this.connectionInfo.opensearch.image,
            );
        }
        if (this.keycloakContainer && this.connectionInfo.keycloak) {
            metadata.keycloak = this.getContainerMetadataFrom(
                this.keycloakContainer,
                this.connectionInfo.keycloak.image,
            );
        }
        if (this.redisContainer && this.connectionInfo.redis) {
            metadata.redis = this.getContainerMetadataFrom(this.redisContainer, this.connectionInfo.redis.image);
        }
        if (this.mattermostContainer && this.connectionInfo.mattermost) {
            metadata.mattermost = this.getContainerMetadataFrom(
                this.mattermostContainer,
                this.connectionInfo.mattermost.image,
            );
        }
        if (this.dejavuContainer && this.connectionInfo.dejavu) {
            metadata.dejavu = this.getContainerMetadataFrom(this.dejavuContainer, this.connectionInfo.dejavu.image);
        }
        if (this.prometheusContainer && this.connectionInfo.prometheus) {
            metadata.prometheus = this.getContainerMetadataFrom(
                this.prometheusContainer,
                this.connectionInfo.prometheus.image,
            );
        }
        if (this.grafanaContainer && this.connectionInfo.grafana) {
            metadata.grafana = this.getContainerMetadataFrom(this.grafanaContainer, this.connectionInfo.grafana.image);
        }
        if (this.lokiContainer && this.connectionInfo.loki) {
            metadata.loki = this.getContainerMetadataFrom(this.lokiContainer, this.connectionInfo.loki.image);
        }
        if (this.promtailContainer && this.connectionInfo.promtail) {
            metadata.promtail = this.getContainerMetadataFrom(
                this.promtailContainer,
                this.connectionInfo.promtail.image,
            );
        }

        // HA mode containers
        if (this.nginxContainer && this.connectionInfo.haCluster) {
            metadata.nginx = this.getContainerMetadataFrom(
                this.nginxContainer,
                this.connectionInfo.haCluster.nginx.image,
            );
        }
        if (this.connectionInfo.haCluster) {
            for (const nodeInfo of this.connectionInfo.haCluster.nodes) {
                const container = this.mattermostNodes.get(nodeInfo.nodeName);
                if (container) {
                    metadata[`mattermost-${nodeInfo.nodeName}`] = this.getContainerMetadataFrom(
                        container,
                        nodeInfo.image,
                    );
                }
            }
        }

        // Subpath mode containers
        if (this.nginxContainer && this.connectionInfo.subpath) {
            metadata.nginx = this.getContainerMetadataFrom(
                this.nginxContainer,
                this.connectionInfo.subpath.nginx.image,
            );
        }
        if (this.mattermostServer1 && this.connectionInfo.mattermost) {
            metadata['mattermost-server1'] = this.getContainerMetadataFrom(
                this.mattermostServer1,
                this.connectionInfo.mattermost.image,
            );
        }
        if (this.mattermostServer2 && this.connectionInfo.mattermost) {
            metadata['mattermost-server2'] = this.getContainerMetadataFrom(
                this.mattermostServer2,
                this.connectionInfo.mattermost.image,
            );
        }
        // Subpath + HA mode containers
        const serverImage = this.config.serverImage ?? getMattermostImage();
        for (const [nodeName, container] of this.server1Nodes) {
            metadata[`mattermost-server1-${nodeName}`] = this.getContainerMetadataFrom(container, serverImage);
        }
        for (const [nodeName, container] of this.server2Nodes) {
            metadata[`mattermost-server2-${nodeName}`] = this.getContainerMetadataFrom(container, serverImage);
        }

        return metadata;
    }

    // Private methods for starting individual dependencies
    private async startPostgres(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getPostgresImage();
        this.postgresContainer = await createPostgresContainer(this.network);
        this.connectionInfo.postgres = getPostgresConnectionInfo(this.postgresContainer, image);
    }

    private async startInbucket(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getInbucketImage();
        this.inbucketContainer = await createInbucketContainer(this.network);
        this.connectionInfo.inbucket = getInbucketConnectionInfo(this.inbucketContainer, image);
    }

    private async startOpenLdap(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getOpenLdapImage();
        this.openldapContainer = await createOpenLdapContainer(this.network);
        this.connectionInfo.openldap = getOpenLdapConnectionInfo(this.openldapContainer, image);
    }

    private async startMinio(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getMinioImage();
        this.minioContainer = await createMinioContainer(this.network);
        this.connectionInfo.minio = getMinioConnectionInfo(this.minioContainer, image);
    }

    private async startElasticsearch(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getElasticsearchImage();
        this.elasticsearchContainer = await createElasticsearchContainer(this.network);
        this.connectionInfo.elasticsearch = getElasticsearchConnectionInfo(this.elasticsearchContainer, image);
    }

    private async startOpenSearch(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getOpenSearchImage();
        this.opensearchContainer = await createOpenSearchContainer(this.network);
        this.connectionInfo.opensearch = getOpenSearchConnectionInfo(this.opensearchContainer, image);
    }

    private async startKeycloak(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getKeycloakImage();
        this.keycloakContainer = await createKeycloakContainer(this.network);
        this.connectionInfo.keycloak = getKeycloakConnectionInfo(this.keycloakContainer, image);
    }

    private async startRedis(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getRedisImage();
        this.redisContainer = await createRedisContainer(this.network);
        this.connectionInfo.redis = getRedisConnectionInfo(this.redisContainer, image);
    }

    private async startDejavu(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getDejavuImage();
        this.dejavuContainer = await createDejavuContainer(this.network);
        this.connectionInfo.dejavu = getDejavuConnectionInfo(this.dejavuContainer, image);
    }

    private async startPrometheus(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getPrometheusImage();
        this.prometheusContainer = await createPrometheusContainer(this.network);
        this.connectionInfo.prometheus = getPrometheusConnectionInfo(this.prometheusContainer, image);
    }

    private async startGrafana(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getGrafanaImage();
        this.grafanaContainer = await createGrafanaContainer(this.network);
        this.connectionInfo.grafana = getGrafanaConnectionInfo(this.grafanaContainer, image);
    }

    private async startLoki(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getLokiImage();
        this.lokiContainer = await createLokiContainer(this.network);
        this.connectionInfo.loki = getLokiConnectionInfo(this.lokiContainer, image);
    }

    private async startPromtail(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');

        const image = getPromtailImage();
        this.promtailContainer = await createPromtailContainer(this.network);
        this.connectionInfo.promtail = getPromtailConnectionInfo(this.promtailContainer, image);
    }

    private async startMattermost(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');
        if (!this.connectionInfo.postgres) throw new Error('PostgreSQL must be started first');

        const deps: MattermostDependencies = {
            postgres: this.connectionInfo.postgres,
            inbucket: this.connectionInfo.inbucket,
        };

        // Build environment overrides for optional dependencies
        const envOverrides: Record<string, string> = {};

        // Note: LDAP settings are configured via mmctl after startup (not env vars)
        // to ensure they persist in the database and can be changed in System Console

        if (this.connectionInfo.minio) {
            envOverrides.MM_FILESETTINGS_DRIVERNAME = 'amazons3';
            envOverrides.MM_FILESETTINGS_AMAZONS3ACCESSKEYID = this.connectionInfo.minio.accessKey;
            envOverrides.MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY = this.connectionInfo.minio.secretKey;
            envOverrides.MM_FILESETTINGS_AMAZONS3BUCKET = 'mattermost-test';
            envOverrides.MM_FILESETTINGS_AMAZONS3ENDPOINT = 'minio:9000';
            envOverrides.MM_FILESETTINGS_AMAZONS3SSL = 'false';
        }

        if (this.connectionInfo.elasticsearch) {
            // Note: EnableIndexing/EnableSearching are set via mmctl after startup (not env var) so they can be changed in System Console
            envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://elasticsearch:9200';
        }

        if (this.connectionInfo.opensearch) {
            // Note: EnableIndexing/EnableSearching are set via mmctl after startup (not env var) so they can be changed in System Console
            envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://opensearch:9200';
            envOverrides.MM_ELASTICSEARCHSETTINGS_BACKEND = 'opensearch';
        }

        if (this.connectionInfo.redis) {
            // Note: CacheType is set via mmctl after startup (not env var) so it can be changed in System Console
            envOverrides.MM_CACHESETTINGS_REDISADDRESS = 'redis:6379';
            envOverrides.MM_CACHESETTINGS_REDISDB = '0';
        }

        // Pass all MM_* environment variables from host to container
        // (except SiteURL which is set via mmctl after startup to use the actual mapped port)
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('MM_') && key !== 'MM_SERVICESETTINGS_SITEURL' && value !== undefined) {
                envOverrides[key] = value;
            }
        }

        // Apply user-provided server environment variables (highest priority)
        // (except SiteURL which is set via mmctl after startup)
        if (this.config.serverEnv) {
            const {MM_SERVICESETTINGS_SITEURL: _siteUrl, ...restEnv} = this.config.serverEnv;
            void _siteUrl; // Intentionally excluded - SiteURL is set via mmctl after startup
            Object.assign(envOverrides, restEnv);
        }

        const serverImage = this.config.serverImage ?? getMattermostImage();
        const mmStartTime = Date.now();
        this.log(`Starting Mattermost (${serverImage})`);

        this.mattermostContainer = await createMattermostContainer(this.network, deps, {
            image: this.config.serverImage,
            envOverrides,
            imageMaxAgeMs: this.config.imageMaxAgeMs,
        });
        this.connectionInfo.mattermost = getMattermostConnectionInfo(this.mattermostContainer, serverImage);
        const mmElapsed = formatElapsed(Date.now() - mmStartTime);
        this.log(`✓ Mattermost ready at ${this.connectionInfo.mattermost.url} (${mmElapsed})`);

        // Update SiteURL to use the actual mapped port (required for emails, OAuth, etc.)
        const mmctl = new MmctlClient(this.mattermostContainer);
        const siteUrlResult = await mmctl.exec(
            `config set ServiceSettings.SiteURL "${this.connectionInfo.mattermost.url}"`,
        );
        if (siteUrlResult.exitCode !== 0) {
            this.log(`⚠ Failed to set SiteURL: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
        }

        // Apply default test settings via mmctl (can be changed in System Console)
        // These are applied first, then user's serverConfig can override them
        // Priority: env var > command option > tc config file > defaults here
        await this.applyDefaultTestSettings(mmctl);

        // Configure LDAP settings if openldap is configured (via mmctl so they persist in DB)
        if (this.connectionInfo.openldap) {
            // Set LDAP attribute mappings first (required for enabling LDAP)
            const ldapAttributes: Record<string, string> = {
                'LdapSettings.LdapServer': 'openldap',
                'LdapSettings.LdapPort': '389',
                'LdapSettings.BaseDN': this.connectionInfo.openldap.baseDN,
                'LdapSettings.BindUsername': this.connectionInfo.openldap.bindDN,
                'LdapSettings.BindPassword': this.connectionInfo.openldap.bindPassword,
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
                    this.log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
                }
            }
            // Now enable LDAP
            const ldapResult = await mmctl.exec('config set LdapSettings.Enable true');
            if (ldapResult.exitCode !== 0) {
                this.log(`⚠ Failed to enable LDAP: ${ldapResult.stdout || ldapResult.stderr}`);
            }

            // Load LDAP test data
            await this.loadLdapTestData();
        }

        // Enable Elasticsearch/OpenSearch if configured (via mmctl so it can be changed in System Console)
        if (this.connectionInfo.elasticsearch || this.connectionInfo.opensearch) {
            const indexingResult = await mmctl.exec('config set ElasticsearchSettings.EnableIndexing true');
            if (indexingResult.exitCode !== 0) {
                this.log(
                    `⚠ Failed to enable Elasticsearch indexing: ${indexingResult.stdout || indexingResult.stderr}`,
                );
            }
            const searchingResult = await mmctl.exec('config set ElasticsearchSettings.EnableSearching true');
            if (searchingResult.exitCode !== 0) {
                this.log(
                    `⚠ Failed to enable Elasticsearch searching: ${searchingResult.stdout || searchingResult.stderr}`,
                );
            }
        }

        // Enable Redis cache if configured (via mmctl so it can be changed in System Console)
        if (this.connectionInfo.redis) {
            const redisResult = await mmctl.exec('config set CacheSettings.CacheType redis');
            if (redisResult.exitCode !== 0) {
                this.log(`⚠ Failed to set Redis cache type: ${redisResult.stdout || redisResult.stderr}`);
            }
        }

        // Note: Keycloak SAML and OpenID settings are NOT pre-configured automatically
        // because SAML requires certificate upload which doesn't work with database config.
        // Users can configure SAML/OpenID manually via System Console or server.config in mm-tc.config.mjs.
        // The Keycloak container has pre-configured clients: 'mattermost' (SAML) and 'mattermost-openid' (OpenID).
        // See .env.tc output for example settings when keycloak is enabled.

        // Apply server config patch via mmctl if provided (overrides defaults)
        if (this.config.serverConfig) {
            await this.patchServerConfig(this.config.serverConfig);
        }
    }

    /**
     * Start Mattermost in HA mode (multi-node cluster with nginx load balancer).
     */
    private async startMattermostHA(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');
        if (!this.connectionInfo.postgres) throw new Error('PostgreSQL must be started first');

        const clusterName = DEFAULT_HA_SETTINGS.clusterName;
        const nodeNames = generateNodeNames(HA_NODE_COUNT);
        const serverImage = this.config.serverImage ?? getMattermostImage();

        this.log(`Starting Mattermost HA cluster (${HA_NODE_COUNT} nodes, cluster: ${clusterName})`);

        const deps: MattermostDependencies = {
            postgres: this.connectionInfo.postgres,
            inbucket: this.connectionInfo.inbucket,
        };

        // Build environment overrides (same as single-node mode)
        const envOverrides: Record<string, string> = {};

        if (this.connectionInfo.minio) {
            envOverrides.MM_FILESETTINGS_DRIVERNAME = 'amazons3';
            envOverrides.MM_FILESETTINGS_AMAZONS3ACCESSKEYID = this.connectionInfo.minio.accessKey;
            envOverrides.MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY = this.connectionInfo.minio.secretKey;
            envOverrides.MM_FILESETTINGS_AMAZONS3BUCKET = 'mattermost-test';
            envOverrides.MM_FILESETTINGS_AMAZONS3ENDPOINT = 'minio:9000';
            envOverrides.MM_FILESETTINGS_AMAZONS3SSL = 'false';
        }

        if (this.connectionInfo.elasticsearch) {
            envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://elasticsearch:9200';
        }

        if (this.connectionInfo.opensearch) {
            envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://opensearch:9200';
            envOverrides.MM_ELASTICSEARCHSETTINGS_BACKEND = 'opensearch';
        }

        if (this.connectionInfo.redis) {
            envOverrides.MM_CACHESETTINGS_REDISADDRESS = 'redis:6379';
            envOverrides.MM_CACHESETTINGS_REDISDB = '0';
        }

        // Pass all MM_* environment variables from host
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('MM_') && key !== 'MM_SERVICESETTINGS_SITEURL' && value !== undefined) {
                envOverrides[key] = value;
            }
        }

        // Apply user-provided server environment variables
        if (this.config.serverEnv) {
            const {MM_SERVICESETTINGS_SITEURL: _siteUrl, ...restEnv} = this.config.serverEnv;
            void _siteUrl;
            Object.assign(envOverrides, restEnv);
        }

        // Start all Mattermost nodes in sequence (leader first, then followers)
        const nodeInfos: MattermostNodeConnectionInfo[] = [];

        for (let i = 0; i < nodeNames.length; i++) {
            const nodeName = nodeNames[i];
            const nodeStartTime = Date.now();
            this.log(`Starting Mattermost ${nodeName}...`);

            const container = await createMattermostContainer(this.network, deps, {
                image: this.config.serverImage,
                envOverrides,
                imageMaxAgeMs: this.config.imageMaxAgeMs,
                cluster: {
                    enable: true,
                    clusterName,
                    nodeName,
                    networkAlias: nodeName,
                },
            });

            this.mattermostNodes.set(nodeName, container);
            const nodeInfo = getMattermostNodeConnectionInfo(container, serverImage, nodeName, nodeName);
            nodeInfos.push(nodeInfo);

            const nodeElapsed = formatElapsed(Date.now() - nodeStartTime);
            this.log(`✓ Mattermost ${nodeName} ready at ${nodeInfo.url} (${nodeElapsed})`);
        }

        // Start nginx load balancer
        const nginxStartTime = Date.now();
        this.log('Starting nginx load balancer...');
        const nginxImage = getNginxImage();

        this.nginxContainer = await createNginxContainer(this.network, {
            nodeAliases: nodeNames,
        });

        const nginxInfo = getNginxConnectionInfo(this.nginxContainer, nginxImage);
        const nginxElapsed = formatElapsed(Date.now() - nginxStartTime);
        this.log(`✓ Nginx load balancer ready at ${nginxInfo.url} (${nginxElapsed})`);

        // Store HA cluster connection info
        this.connectionInfo.haCluster = {
            url: nginxInfo.url,
            nginx: nginxInfo,
            nodes: nodeInfos,
            clusterName,
        };

        // Also set mattermost info to leader node for backwards compatibility
        this.connectionInfo.mattermost = nodeInfos[0];

        // Configure the cluster via mmctl on the leader node
        const leaderContainer = this.mattermostNodes.get('leader');
        if (leaderContainer) {
            const mmctl = new MmctlClient(leaderContainer);

            // Set SiteURL to the load balancer URL
            const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${nginxInfo.url}"`);
            if (siteUrlResult.exitCode !== 0) {
                this.log(`⚠ Failed to set SiteURL: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
            }

            // Apply default test settings
            await this.applyDefaultTestSettings(mmctl);

            // Configure LDAP settings if openldap is configured
            if (this.connectionInfo.openldap) {
                const ldapAttributes: Record<string, string> = {
                    'LdapSettings.LdapServer': 'openldap',
                    'LdapSettings.LdapPort': '389',
                    'LdapSettings.BaseDN': this.connectionInfo.openldap.baseDN,
                    'LdapSettings.BindUsername': this.connectionInfo.openldap.bindDN,
                    'LdapSettings.BindPassword': this.connectionInfo.openldap.bindPassword,
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
                        this.log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
                    }
                }
                const ldapResult = await mmctl.exec('config set LdapSettings.Enable true');
                if (ldapResult.exitCode !== 0) {
                    this.log(`⚠ Failed to enable LDAP: ${ldapResult.stdout || ldapResult.stderr}`);
                }
                await this.loadLdapTestData();
            }

            // Enable Elasticsearch/OpenSearch if configured
            if (this.connectionInfo.elasticsearch || this.connectionInfo.opensearch) {
                await mmctl.exec('config set ElasticsearchSettings.EnableIndexing true');
                await mmctl.exec('config set ElasticsearchSettings.EnableSearching true');
            }

            // Enable Redis cache if configured
            if (this.connectionInfo.redis) {
                await mmctl.exec('config set CacheSettings.CacheType redis');
            }

            // Apply server config patch via mmctl if provided
            if (this.config.serverConfig) {
                await this.patchServerConfigHA(this.config.serverConfig, mmctl);
            }
        }

        this.log(`✓ Mattermost HA cluster ready (${HA_NODE_COUNT} nodes)`);
    }

    /**
     * Start Mattermost in subpath mode (two servers behind nginx with /mattermost1 and /mattermost2).
     * Can be combined with HA mode for 6 total nodes (3 per server).
     */
    private async startMattermostSubpath(): Promise<void> {
        if (!this.network) throw new Error('Network not initialized');
        if (!this.connectionInfo.postgres) throw new Error('PostgreSQL must be started first');

        const isHA = this.config.ha ?? false;
        const serverImage = this.config.serverImage ?? getMattermostImage();

        if (isHA) {
            this.log('Starting Mattermost subpath + HA mode (2 servers x 3 nodes each)');
        } else {
            this.log('Starting Mattermost subpath mode (2 servers)');
        }

        // Create second database for server2
        await this.createSubpathDatabase();

        // Build environment overrides (same as single-node mode)
        const baseEnvOverrides = this.buildSubpathEnvOverrides();

        // Server 1 and Server 2 configuration
        const servers = [
            {
                name: 'server1',
                subpath: '/mattermost1',
                database: this.connectionInfo.postgres.database, // Use existing database
                networkAlias: 'mattermost1',
            },
            {
                name: 'server2',
                subpath: '/mattermost2',
                database: 'mattermost_test_2', // Use second database
                networkAlias: 'mattermost2',
            },
        ];

        // Track server URLs for later nginx configuration
        const server1Aliases: string[] = [];
        const server2Aliases: string[] = [];

        if (isHA) {
            // HA + Subpath: Start 3 nodes per server (6 total)
            const clusterName = DEFAULT_HA_SETTINGS.clusterName;
            const nodeNames = generateNodeNames(HA_NODE_COUNT);

            for (const server of servers) {
                const aliases = server.name === 'server1' ? server1Aliases : server2Aliases;
                const nodes = server.name === 'server1' ? this.server1Nodes : this.server2Nodes;

                // NOTE: We do NOT set MM_SERVICESETTINGS_SITEURL via env var because env vars
                // override database config, preventing mmctl from updating SiteURL later.
                // SiteURL is set via mmctl after nginx starts with the correct external URL.

                for (let i = 0; i < nodeNames.length; i++) {
                    const nodeName = nodeNames[i];
                    const nodeAlias = `${server.networkAlias}-${nodeName}`;
                    aliases.push(nodeAlias);

                    const nodeStartTime = Date.now();
                    this.log(`Starting Mattermost ${server.name}-${nodeName}...`);

                    // Build database URL for this server
                    const dbUrl = `postgres://${this.connectionInfo.postgres.username}:${this.connectionInfo.postgres.password}@postgres:${INTERNAL_PORTS.postgres}/${server.database}?sslmode=disable`;

                    const container = await createMattermostContainer(
                        this.network!,
                        this.buildSubpathDeps(server.database),
                        {
                            image: this.config.serverImage,
                            envOverrides: {
                                ...baseEnvOverrides,
                                MM_CONFIG: dbUrl,
                                MM_SQLSETTINGS_DATASOURCE: dbUrl,
                                // SiteURL set via mmctl after nginx starts
                            },
                            imageMaxAgeMs: this.config.imageMaxAgeMs,
                            cluster: {
                                enable: true,
                                clusterName: `${clusterName}_${server.name}`,
                                nodeName,
                                networkAlias: nodeAlias,
                            },
                            // No subpath for health check - SiteURL not set yet
                        },
                    );

                    nodes.set(nodeName, container);
                    const nodeElapsed = formatElapsed(Date.now() - nodeStartTime);
                    this.log(`✓ Mattermost ${server.name}-${nodeName} ready (${nodeElapsed})`);
                }
            }
        } else {
            // Single node per server
            for (const server of servers) {
                const aliases = server.name === 'server1' ? server1Aliases : server2Aliases;
                aliases.push(server.networkAlias);

                const serverStartTime = Date.now();
                this.log(`Starting Mattermost ${server.name}...`);

                // Build database URL for this server
                const dbUrl = `postgres://${this.connectionInfo.postgres.username}:${this.connectionInfo.postgres.password}@postgres:${INTERNAL_PORTS.postgres}/${server.database}?sslmode=disable`;

                // NOTE: We do NOT set MM_SERVICESETTINGS_SITEURL via env var because env vars
                // override database config, preventing mmctl from updating SiteURL later.
                // SiteURL is set via mmctl after nginx starts with the correct external URL.

                const container = await createMattermostContainer(
                    this.network!,
                    this.buildSubpathDeps(server.database),
                    {
                        image: this.config.serverImage,
                        envOverrides: {
                            ...baseEnvOverrides,
                            MM_CONFIG: dbUrl,
                            MM_SQLSETTINGS_DATASOURCE: dbUrl,
                            // SiteURL set via mmctl after nginx starts
                        },
                        imageMaxAgeMs: this.config.imageMaxAgeMs,
                        cluster: {
                            enable: false,
                            clusterName: '',
                            nodeName: server.name,
                            networkAlias: server.networkAlias,
                        },
                        // No subpath for health check - SiteURL not set yet
                    },
                );

                if (server.name === 'server1') {
                    this.mattermostServer1 = container;
                } else {
                    this.mattermostServer2 = container;
                }

                const serverElapsed = formatElapsed(Date.now() - serverStartTime);
                const host = container.getHost();
                const port = container.getMappedPort(INTERNAL_PORTS.mattermost);
                this.log(`✓ Mattermost ${server.name} ready at http://${host}:${port} (${serverElapsed})`);
            }
        }

        // Start nginx load balancer with subpath configuration
        const nginxStartTime = Date.now();
        this.log('Starting nginx with subpath routing...');
        const nginxImage = getNginxImage();

        this.nginxContainer = await createSubpathNginxContainer(this.network, {
            server1Aliases,
            server2Aliases,
        });

        const nginxInfo = getNginxConnectionInfo(this.nginxContainer, nginxImage);
        const nginxElapsed = formatElapsed(Date.now() - nginxStartTime);
        this.log(`✓ Nginx ready at ${nginxInfo.url} (${nginxElapsed})`);

        // Get direct URLs for each server
        let server1DirectUrl: string;
        let server2DirectUrl: string;

        if (isHA) {
            // In HA mode, use leader node URL
            const server1Leader = this.server1Nodes.get('leader');
            const server2Leader = this.server2Nodes.get('leader');
            if (!server1Leader || !server2Leader) {
                throw new Error('Failed to get leader nodes for subpath servers');
            }
            server1DirectUrl = `http://${server1Leader.getHost()}:${server1Leader.getMappedPort(INTERNAL_PORTS.mattermost)}`;
            server2DirectUrl = `http://${server2Leader.getHost()}:${server2Leader.getMappedPort(INTERNAL_PORTS.mattermost)}`;
        } else {
            if (!this.mattermostServer1 || !this.mattermostServer2) {
                throw new Error('Failed to start subpath servers');
            }
            server1DirectUrl = `http://${this.mattermostServer1.getHost()}:${this.mattermostServer1.getMappedPort(INTERNAL_PORTS.mattermost)}`;
            server2DirectUrl = `http://${this.mattermostServer2.getHost()}:${this.mattermostServer2.getMappedPort(INTERNAL_PORTS.mattermost)}`;
        }

        // Store subpath connection info
        this.connectionInfo.subpath = {
            url: nginxInfo.url,
            server1Url: `${nginxInfo.url}/mattermost1`,
            server2Url: `${nginxInfo.url}/mattermost2`,
            server1DirectUrl,
            server2DirectUrl,
            nginx: nginxInfo,
        };

        // Configure each server via mmctl
        await this.configureSubpathServer('server1', server1Aliases, nginxInfo.url);
        await this.configureSubpathServer('server2', server2Aliases, nginxInfo.url);

        // Set mattermost info to server1 for backwards compatibility
        this.connectionInfo.mattermost = {
            host: this.connectionInfo.subpath.nginx.host,
            port: this.connectionInfo.subpath.nginx.port,
            url: this.connectionInfo.subpath.server1Url,
            internalUrl: `http://mattermost1:${INTERNAL_PORTS.mattermost}`,
            image: serverImage,
        };

        if (isHA) {
            this.log('✓ Mattermost subpath + HA mode ready (6 nodes)');
        } else {
            this.log('✓ Mattermost subpath mode ready (2 servers)');
        }
    }

    /**
     * Create second database for subpath server2.
     */
    private async createSubpathDatabase(): Promise<void> {
        if (!this.postgresContainer) {
            throw new Error('PostgreSQL container not running');
        }

        this.log('Creating second database for server2...');

        const username = this.connectionInfo.postgres!.username;
        const password = this.connectionInfo.postgres!.password;

        // Execute SQL to create second database using bash with PGPASSWORD
        const result = await this.postgresContainer.exec([
            'bash',
            '-c',
            `PGPASSWORD='${password}' psql -U ${username} -d postgres -c "CREATE DATABASE mattermost_test_2;"`,
        ]);

        if (result.exitCode !== 0 && !result.output.includes('already exists')) {
            throw new Error(`Failed to create second database: ${result.output}`);
        }

        // Grant privileges
        const grantResult = await this.postgresContainer.exec([
            'bash',
            '-c',
            `PGPASSWORD='${password}' psql -U ${username} -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE mattermost_test_2 TO ${username};"`,
        ]);

        if (grantResult.exitCode !== 0) {
            throw new Error(`Failed to grant privileges on second database: ${grantResult.output}`);
        }

        this.log('✓ Second database created');
    }

    /**
     * Build dependencies for subpath server.
     */
    private buildSubpathDeps(database: string): MattermostDependencies {
        return {
            postgres: {
                ...this.connectionInfo.postgres!,
                database,
            },
            inbucket: this.connectionInfo.inbucket,
        };
    }

    /**
     * Build base environment overrides for subpath servers.
     */
    private buildSubpathEnvOverrides(): Record<string, string> {
        const envOverrides: Record<string, string> = {};

        if (this.connectionInfo.minio) {
            envOverrides.MM_FILESETTINGS_DRIVERNAME = 'amazons3';
            envOverrides.MM_FILESETTINGS_AMAZONS3ACCESSKEYID = this.connectionInfo.minio.accessKey;
            envOverrides.MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY = this.connectionInfo.minio.secretKey;
            envOverrides.MM_FILESETTINGS_AMAZONS3BUCKET = 'mattermost-test';
            envOverrides.MM_FILESETTINGS_AMAZONS3ENDPOINT = 'minio:9000';
            envOverrides.MM_FILESETTINGS_AMAZONS3SSL = 'false';
        }

        if (this.connectionInfo.elasticsearch) {
            envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://elasticsearch:9200';
        }

        if (this.connectionInfo.opensearch) {
            envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://opensearch:9200';
            envOverrides.MM_ELASTICSEARCHSETTINGS_BACKEND = 'opensearch';
        }

        if (this.connectionInfo.redis) {
            envOverrides.MM_CACHESETTINGS_REDISADDRESS = 'redis:6379';
            envOverrides.MM_CACHESETTINGS_REDISDB = '0';
        }

        // Pass all MM_* environment variables from host
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('MM_') && key !== 'MM_SERVICESETTINGS_SITEURL' && value !== undefined) {
                envOverrides[key] = value;
            }
        }

        // Apply user-provided server environment variables
        if (this.config.serverEnv) {
            const {MM_SERVICESETTINGS_SITEURL: _siteUrl, ...restEnv} = this.config.serverEnv;
            void _siteUrl;
            Object.assign(envOverrides, restEnv);
        }

        return envOverrides;
    }

    /**
     * Configure a subpath server via mmctl.
     */
    private async configureSubpathServer(serverName: string, nodeAliases: string[], nginxUrl: string): Promise<void> {
        const isHA = this.config.ha ?? false;
        const subpath = serverName === 'server1' ? '/mattermost1' : '/mattermost2';
        const siteUrl = `${nginxUrl}${subpath}`;

        // Get the container to run mmctl on
        let container: StartedTestContainer | null = null;
        if (isHA) {
            const nodes = serverName === 'server1' ? this.server1Nodes : this.server2Nodes;
            container = nodes.get('leader') || null;
        } else {
            container = serverName === 'server1' ? this.mattermostServer1 : this.mattermostServer2;
        }

        if (!container) {
            this.log(`⚠ Could not configure ${serverName}: container not found`);
            return;
        }

        const mmctl = new MmctlClient(container);

        // Set SiteURL with subpath
        const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${siteUrl}"`);
        if (siteUrlResult.exitCode !== 0) {
            this.log(`⚠ Failed to set SiteURL for ${serverName}: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
        }

        // Verify SiteURL was actually set by reading it back
        const verifyResult = await mmctl.exec('config get ServiceSettings.SiteURL');
        if (verifyResult.exitCode === 0) {
            const actualSiteUrl = verifyResult.stdout.trim();
            if (!actualSiteUrl.includes(siteUrl)) {
                this.log(
                    `⚠ SiteURL verification failed for ${serverName}: expected "${siteUrl}", got "${actualSiteUrl}"`,
                );
            }
        }

        // Apply default test settings
        await this.applyDefaultTestSettings(mmctl);

        // Configure LDAP settings if openldap is configured
        if (this.connectionInfo.openldap) {
            const ldapAttributes: Record<string, string> = {
                'LdapSettings.LdapServer': 'openldap',
                'LdapSettings.LdapPort': '389',
                'LdapSettings.BaseDN': this.connectionInfo.openldap.baseDN,
                'LdapSettings.BindUsername': this.connectionInfo.openldap.bindDN,
                'LdapSettings.BindPassword': this.connectionInfo.openldap.bindPassword,
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
                await mmctl.exec(`config set ${key} "${value}"`);
            }
            await mmctl.exec('config set LdapSettings.Enable true');
        }

        // Enable Elasticsearch/OpenSearch if configured
        if (this.connectionInfo.elasticsearch || this.connectionInfo.opensearch) {
            await mmctl.exec('config set ElasticsearchSettings.EnableIndexing true');
            await mmctl.exec('config set ElasticsearchSettings.EnableSearching true');
        }

        // Enable Redis cache if configured
        if (this.connectionInfo.redis) {
            await mmctl.exec('config set CacheSettings.CacheType redis');
        }

        // Apply server config patch via mmctl if provided
        if (this.config.serverConfig) {
            await this.patchServerConfigHA(this.config.serverConfig, mmctl);
        }

        this.log(`✓ ${serverName} configured with SiteURL: ${siteUrl}`);
    }

    /**
     * Patch server configuration via mmctl for HA mode.
     * Uses the provided mmctl client (connected to leader node).
     */
    private async patchServerConfigHA(config: Record<string, unknown>, mmctl: MmctlClient): Promise<void> {
        this.log('Patching server configuration via mmctl (HA mode)');

        for (const [section, settings] of Object.entries(config)) {
            if (typeof settings === 'object' && settings !== null) {
                for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
                    const configKey = `${section}.${key}`;
                    const configValue = this.formatConfigValue(value);

                    const result = await mmctl.exec(`config set ${configKey} ${configValue}`);
                    if (result.exitCode !== 0) {
                        this.log(`⚠ Failed to set ${configKey}: ${result.stdout || result.stderr}`);
                    }
                }
            }
        }

        this.log('✓ Server configuration patched (HA mode)');
    }

    /**
     * Apply default test settings via mmctl.
     * These settings can be changed in System Console (not locked by env vars).
     */
    private async applyDefaultTestSettings(mmctl: MmctlClient): Promise<void> {
        const defaults: Record<string, string | boolean> = {
            // Service settings
            'ServiceSettings.EnableLocalMode': true,
            'ServiceSettings.EnableTesting': true,
            'ServiceSettings.EnableDeveloper': true,
            'ServiceSettings.AllowCorsFrom': '*',
            'ServiceSettings.EnableSecurityFixAlert': false,
            // Note: ServiceEnvironment is set via env var only (not mmctl), handled in startMattermost()
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

        for (const [key, value] of Object.entries(defaults)) {
            const formattedValue = this.formatConfigValue(value);
            const result = await mmctl.exec(`config set ${key} ${formattedValue}`);
            if (result.exitCode !== 0) {
                this.log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
            }
        }
    }

    /**
     * Patch server configuration via mmctl.
     * Follows mmctl config set documentation:
     * - String values are double-quoted
     * - Arrays are passed as multiple quoted arguments
     * - Objects/complex values are JSON-stringified with single quotes
     *
     * @param config Partial config object to merge with the server's config
     * @see https://docs.mattermost.com/manage/mmctl-command-line-tool.html#mmctl-config-set
     */
    private async patchServerConfig(config: Record<string, unknown>): Promise<void> {
        this.log('Patching server configuration via mmctl');
        const mmctl = this.getMmctl();

        // Apply each top-level config section
        for (const [section, settings] of Object.entries(config)) {
            if (typeof settings === 'object' && settings !== null) {
                for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
                    const configKey = `${section}.${key}`;
                    const configValue = this.formatConfigValue(value);

                    const result = await mmctl.exec(`config set ${configKey} ${configValue}`);
                    if (result.exitCode !== 0) {
                        this.log(`⚠ Failed to set ${configKey}: ${result.stdout || result.stderr}`);
                    }
                }
            }
        }

        this.log('✓ Server configuration patched');
    }

    /**
     * Format a config value for mmctl config set command.
     * - Strings: double-quoted (escaped internal quotes)
     * - Numbers/booleans: as-is (mmctl handles these)
     * - Arrays of strings: multiple double-quoted values
     * - Objects/complex: single-quoted JSON string
     */
    private formatConfigValue(value: unknown): string {
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
     * Load LDAP test data (schemas and users) into the OpenLDAP container.
     * This mirrors what server/Makefile does in start-docker-openldap-test-data.
     */
    private async loadLdapTestData(): Promise<void> {
        if (!this.openldapContainer) {
            throw new Error('OpenLDAP container not running');
        }

        this.log('Loading LDAP test data...');

        // Schema files that need to be loaded via ldapadd -Y EXTERNAL
        const schemaFiles = ['custom-schema-objectID.ldif', 'custom-schema-cpa.ldif'];

        // Test data file loaded via ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com"
        const dataFile = 'test-data.ldif';

        // Load schema files
        for (const schemaFile of schemaFiles) {
            const result = await this.openldapContainer.exec([
                'ldapadd',
                '-Y',
                'EXTERNAL',
                '-H',
                'ldapi:///',
                '-f',
                `/container/service/slapd/assets/test/${schemaFile}`,
            ]);
            if (result.exitCode !== 0 && !result.output.includes('Already exists')) {
                this.log(`⚠ Failed to load ${schemaFile}: ${result.output}`);
            }
        }

        // Load test data
        const dataResult = await this.openldapContainer.exec([
            'ldapadd',
            '-x',
            '-D',
            'cn=admin,dc=mm,dc=test,dc=com',
            '-w',
            'mostest',
            '-f',
            `/container/service/slapd/assets/test/${dataFile}`,
        ]);
        if (dataResult.exitCode !== 0 && !dataResult.output.includes('Already exists')) {
            this.log(`⚠ Failed to load ${dataFile}: ${dataResult.output}`);
        }

        this.log('✓ LDAP test data loaded');
    }

    /**
     * Upload SAML IDP certificate and configure SAML settings for Keycloak.
     * This fully configures SAML authentication with Keycloak.
     * @returns Result object with success status and optional error message
     */
    async uploadSamlIdpCertificate(): Promise<{success: boolean; error?: string}> {
        // Check for Mattermost container (single node, HA leader, or subpath server1)
        const hasMattermost =
            this.mattermostContainer ||
            this.mattermostNodes.get('leader') ||
            this.mattermostServer1 ||
            this.server1Nodes.get('leader');
        if (!hasMattermost || !this.connectionInfo.mattermost || !this.connectionInfo.keycloak) {
            return {success: false, error: 'Mattermost or Keycloak container not running'};
        }

        try {
            this.log('Configuring SAML with Keycloak...');

            // In subpath mode, configure SAML on both servers
            if (this.connectionInfo.subpath) {
                // Configure server1
                const result1 = await this.configureSamlForServer(
                    'server1',
                    this.connectionInfo.subpath.server1DirectUrl,
                    this.connectionInfo.subpath.server1Url,
                );
                if (!result1.success) {
                    return result1;
                }

                // Configure server2
                const result2 = await this.configureSamlForServer(
                    'server2',
                    this.connectionInfo.subpath.server2DirectUrl,
                    this.connectionInfo.subpath.server2Url,
                );
                if (!result2.success) {
                    return result2;
                }

                // Update Keycloak SAML client with both server URLs
                await this.updateKeycloakSamlClientForSubpath();

                return {success: true};
            } else {
                // Single server or HA mode
                const serverUrl = this.connectionInfo.mattermost.url;
                const directUrl = serverUrl; // Same URL for non-subpath mode
                const result = await this.configureSamlForServer('mattermost', directUrl, serverUrl);
                if (!result.success) {
                    return result;
                }

                // Update Keycloak SAML client
                await this.updateKeycloakSamlClient(serverUrl);

                return {success: true};
            }
        } catch (err) {
            return {success: false, error: String(err)};
        }
    }

    /**
     * Configure SAML for a single Mattermost server.
     */
    private async configureSamlForServer(
        serverName: string,
        directUrl: string,
        siteUrl: string,
    ): Promise<{success: boolean; error?: string}> {
        const certificate = `-----BEGIN CERTIFICATE-----
MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0MB4XDTI0MDIyMTIwNDA0OFoXDTM0MDIyMTIwNDIyOFowFTETMBEGA1UEAwwKbWF0dGVybW9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOnsgNexkO5tbKkFXN+SdMUuLHbqdjZ9/JSnKrYPHLarf8801YDDzV8wI9jjdCCgq+xtKFKWlwU2rGpjPbefDLV1m7CSu0Iq+hNxDiBdX3wkEIK98piDpx+xYGL0aAbXn3nAlqFOWQJLKLM1I65ZmK31YZeVj4Kn01W4WfsvKHoxPjLPwPTug4HB6vaQXqEpzYYYHyuJKvIYNuVwo0WQdaPRXb0poZoYzOnoB6tOFrim6B7/chqtZeXQc7h6/FejBsV59aO5uATI0aAJw1twzjCNIiOeJLB2jlLuIMR3/Yaqr8IRpRXzcRPETpisWNilhV07ZBW0YL9ZwuU4sHWy+iMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW4I1egm+czdnnZxTtth3cjCmLg/UsalUDKSfFOLAlnbe6TtVhP4DpAl+OaQO4+kdEKemLENPmh4ddaHUjSSbbCQZo8B7IjByEe7x3kQdj2ucQpA4bh0vGZ11pVhk5HfkGqAO+UVNQsyLpTmWXQ8SEbxcw6mlTM4SjuybqaGOva1LBscI158Uq5FOVT6TJaxCt3dQkBH0tK+vhRtIM13pNZ/+SFgecn16AuVdBfjjqXynefrSihQ20BZ3NTyjs/N5J2qvSwQ95JARZrlhfiS++L81u2N/0WWni9cXmHsdTLxRrDZjz2CXBNeFOBRio74klSx8tMK27/2lxMsEC7R+DA==
-----END CERTIFICATE-----`;

        // Get mmctl client for this server
        const mmctl = this.getMmctlForServer(serverName);
        if (!mmctl) {
            return {success: false, error: `Could not get mmctl client for ${serverName}`};
        }

        // Admin credentials
        const adminUsername = this.config.admin?.username || 'sysadmin';
        const adminPassword = this.config.admin?.password || 'Sys@dmin-sample1';
        const adminEmail = `${adminUsername}@sample.mattermost.com`;

        // Step 1: Create admin user
        const createResult = await mmctl.exec(
            `user create --email "${adminEmail}" --username "${adminUsername}" --password "${adminPassword}" --system-admin`,
        );
        if (createResult.exitCode !== 0 && !createResult.stdout.includes('already exists')) {
            this.log(`⚠ Failed to create admin user on ${serverName}: ${createResult.stdout || createResult.stderr}`);
            return {success: false, error: `Failed to create admin user on ${serverName}: ${createResult.stdout}`};
        }
        this.log(`✓ Admin user ready on ${serverName} (${adminUsername})`);

        // Step 2: Login to get a token
        // Use directUrl for API calls - no subpath needed when accessing container directly
        // The subpath is only for nginx routing, not for direct container access
        const parsedUrl = new URL(directUrl);
        const apiHost = parsedUrl.hostname;
        const apiPort = parseInt(parsedUrl.port, 10) || 80;

        const loginResult = await this.httpPost(
            apiHost,
            apiPort,
            '/api/v4/users/login',
            JSON.stringify({login_id: adminUsername, password: adminPassword}),
            {'Content-Type': 'application/json'},
        );

        if (!loginResult.success || !loginResult.token) {
            this.log(`⚠ Failed to login on ${serverName}: ${loginResult.error || 'No token received'}`);
            return {
                success: false,
                error: `Failed to login on ${serverName}: ${loginResult.error || 'No token received'}`,
            };
        }

        // Step 3: Upload the certificate
        const uploadResult = await this.httpPost(apiHost, apiPort, '/api/v4/saml/certificate/idp', certificate, {
            'Content-Type': 'application/x-pem-file',
            Authorization: `Bearer ${loginResult.token}`,
        });

        if (!uploadResult.success) {
            return {success: false, error: `Failed to upload certificate on ${serverName}: ${uploadResult.error}`};
        }
        this.log(`✓ SAML IDP certificate uploaded on ${serverName}`);

        // Step 4: Configure SAML settings via mmctl
        const keycloakExternalUrl = `http://${this.connectionInfo.keycloak!.host}:${this.connectionInfo.keycloak!.port}`;

        const samlSettings: Record<string, string | boolean> = {
            'SamlSettings.IdpURL': `${keycloakExternalUrl}/realms/mattermost/protocol/saml`,
            'SamlSettings.IdpDescriptorURL': `${keycloakExternalUrl}/realms/mattermost`,
            'SamlSettings.ServiceProviderIdentifier': 'mattermost',
            'SamlSettings.AssertionConsumerServiceURL': `${siteUrl}/login/sso/saml`,
            'SamlSettings.SignatureAlgorithm': 'RSAwithSHA256',
            'SamlSettings.CanonicalAlgorithm': 'Canonical1.0',
            'SamlSettings.IdAttribute': 'id',
            'SamlSettings.FirstNameAttribute': 'firstName',
            'SamlSettings.LastNameAttribute': 'lastName',
            'SamlSettings.EmailAttribute': 'email',
            'SamlSettings.UsernameAttribute': 'username',
            'SamlSettings.Verify': false,
            'SamlSettings.Encrypt': false,
            'SamlSettings.SignRequest': false,
            'SamlSettings.LoginButtonText': 'SAML',
            'SamlSettings.LoginButtonColor': '#34a28b',
            'SamlSettings.LoginButtonTextColor': '#ffffff',
        };

        for (const [key, value] of Object.entries(samlSettings)) {
            const formattedValue = this.formatConfigValue(value);
            await mmctl.exec(`config set ${key} ${formattedValue}`);
        }

        // Enable SAML
        const enableResult = await mmctl.exec('config set SamlSettings.Enable true');
        if (enableResult.exitCode !== 0) {
            this.log(`⚠ Failed to enable SAML on ${serverName}: ${enableResult.stdout || enableResult.stderr}`);
            return {success: false, error: `Failed to enable SAML on ${serverName}`};
        }
        this.log(`✓ SAML enabled on ${serverName}`);

        return {success: true};
    }

    /**
     * Get mmctl client for a specific server in subpath mode.
     */
    private getMmctlForServer(serverName: string): MmctlClient | null {
        if (serverName === 'mattermost') {
            // Non-subpath mode
            return this.getMmctl();
        }

        if (serverName === 'server1') {
            // Subpath + HA mode
            const leader = this.server1Nodes.get('leader');
            if (leader) return new MmctlClient(leader);
            // Subpath single node mode
            if (this.mattermostServer1) return new MmctlClient(this.mattermostServer1);
        }

        if (serverName === 'server2') {
            // Subpath + HA mode
            const leader = this.server2Nodes.get('leader');
            if (leader) return new MmctlClient(leader);
            // Subpath single node mode
            if (this.mattermostServer2) return new MmctlClient(this.mattermostServer2);
        }

        return null;
    }

    /**
     * Update Keycloak SAML client for subpath mode with both server URLs.
     */
    private async updateKeycloakSamlClientForSubpath(): Promise<void> {
        if (!this.connectionInfo.keycloak || !this.connectionInfo.subpath) {
            return;
        }

        const {host, port} = this.connectionInfo.keycloak;
        const {server1Url, server2Url, url: nginxUrl} = this.connectionInfo.subpath;

        try {
            // Get Keycloak admin token
            const tokenResult = await this.httpPost(
                host,
                port,
                '/realms/master/protocol/openid-connect/token',
                'grant_type=password&client_id=admin-cli&username=admin&password=admin',
                {'Content-Type': 'application/x-www-form-urlencoded'},
            );

            if (!tokenResult.success || !tokenResult.body) {
                this.log(`⚠ Failed to get Keycloak admin token: ${tokenResult.error}`);
                return;
            }

            const tokenData = JSON.parse(tokenResult.body);
            const accessToken = tokenData.access_token;

            // Get the SAML client ID
            const clientsResult = await this.httpGet(
                host,
                port,
                '/admin/realms/mattermost/clients?clientId=mattermost',
                {Authorization: `Bearer ${accessToken}`},
            );

            if (!clientsResult.success || !clientsResult.body) {
                this.log(`⚠ Failed to get Keycloak clients: ${clientsResult.error}`);
                return;
            }

            const clients = JSON.parse(clientsResult.body);
            if (!clients || clients.length === 0) {
                this.log('⚠ SAML client not found in Keycloak');
                return;
            }

            const clientId = clients[0].id;

            // Update the client with both server URLs
            const updatedClient = {
                ...clients[0],
                rootUrl: nginxUrl,
                baseUrl: nginxUrl,
                redirectUris: [
                    `${server1Url}/login/sso/saml`,
                    `${server1Url}/*`,
                    `${server2Url}/login/sso/saml`,
                    `${server2Url}/*`,
                ],
                webOrigins: [nginxUrl, server1Url, server2Url],
            };

            const updateResult = await this.httpPut(
                host,
                port,
                `/admin/realms/mattermost/clients/${clientId}`,
                JSON.stringify(updatedClient),
                {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            );

            if (!updateResult.success) {
                this.log(`⚠ Failed to update Keycloak SAML client: ${updateResult.error}`);
                return;
            }

            this.log(`✓ Keycloak SAML client updated for subpath mode`);
        } catch (err) {
            this.log(`⚠ Failed to update Keycloak SAML client: ${err}`);
        }
    }

    /**
     * Update Keycloak SAML client configuration with the correct Mattermost URL.
     * This sets the proper rootUrl, redirectUris, and webOrigins instead of wildcards.
     */
    private async updateKeycloakSamlClient(mattermostUrl: string): Promise<void> {
        if (!this.connectionInfo.keycloak) {
            this.log('⚠ Keycloak not available, skipping client update');
            return;
        }

        const {host, port} = this.connectionInfo.keycloak;

        try {
            // Step 1: Get Keycloak admin token
            const tokenResult = await this.httpPost(
                host,
                port,
                '/realms/master/protocol/openid-connect/token',
                'grant_type=password&client_id=admin-cli&username=admin&password=admin',
                {'Content-Type': 'application/x-www-form-urlencoded'},
            );

            if (!tokenResult.success || !tokenResult.body) {
                this.log(`⚠ Failed to get Keycloak admin token: ${tokenResult.error}`);
                return;
            }

            const tokenData = JSON.parse(tokenResult.body);
            const accessToken = tokenData.access_token;

            // Step 2: Get the SAML client ID
            const clientsResult = await this.httpGet(
                host,
                port,
                '/admin/realms/mattermost/clients?clientId=mattermost',
                {Authorization: `Bearer ${accessToken}`},
            );

            if (!clientsResult.success || !clientsResult.body) {
                this.log(`⚠ Failed to get Keycloak clients: ${clientsResult.error}`);
                return;
            }

            const clients = JSON.parse(clientsResult.body);
            if (!clients || clients.length === 0) {
                this.log('⚠ SAML client not found in Keycloak');
                return;
            }

            const clientId = clients[0].id;

            // Step 3: Update the client with correct Mattermost URL
            const updatedClient = {
                ...clients[0],
                rootUrl: mattermostUrl,
                baseUrl: mattermostUrl,
                redirectUris: [`${mattermostUrl}/login/sso/saml`, `${mattermostUrl}/*`],
                webOrigins: [mattermostUrl],
            };

            const updateResult = await this.httpPut(
                host,
                port,
                `/admin/realms/mattermost/clients/${clientId}`,
                JSON.stringify(updatedClient),
                {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            );

            if (!updateResult.success) {
                this.log(`⚠ Failed to update Keycloak SAML client: ${updateResult.error}`);
                return;
            }

            this.log(`✓ Keycloak SAML client updated with Mattermost URL: ${mattermostUrl}`);
        } catch (err) {
            this.log(`⚠ Failed to update Keycloak SAML client: ${err}`);
        }
    }

    /**
     * Make an HTTP POST request.
     * @param host Hostname
     * @param port Port number
     * @param path URL path
     * @param body Request body
     * @param headers Request headers
     * @returns Result object with success status, response body, token (from header), and optional error
     */
    private httpPost(
        host: string,
        port: number,
        path: string,
        body: string,
        headers: Record<string, string> = {},
    ): Promise<{success: boolean; body?: string; token?: string; error?: string}> {
        return new Promise((resolve) => {
            const options = {
                hostname: host,
                port,
                path,
                method: 'POST',
                headers: {
                    'Content-Length': Buffer.byteLength(body),
                    ...headers,
                },
            };

            const req = http.request(options, (res: IncomingMessage) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => {
                    responseBody += chunk.toString();
                });
                res.on('end', () => {
                    // Extract token from response header (used by login endpoint)
                    const token = res.headers['token'] as string | undefined;

                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({success: true, body: responseBody, token});
                    } else {
                        resolve({
                            success: false,
                            body: responseBody,
                            error: `HTTP ${res.statusCode}: ${responseBody}`,
                        });
                    }
                });
            });

            req.on('error', (err: Error) => {
                resolve({success: false, error: err.message});
            });

            req.write(body);
            req.end();
        });
    }

    /**
     * Make an HTTP GET request.
     */
    private httpGet(
        host: string,
        port: number,
        path: string,
        headers: Record<string, string> = {},
    ): Promise<{success: boolean; body?: string; error?: string}> {
        return new Promise((resolve) => {
            const options = {
                hostname: host,
                port,
                path,
                method: 'GET',
                headers,
            };

            const req = http.request(options, (res: IncomingMessage) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => {
                    responseBody += chunk.toString();
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({success: true, body: responseBody});
                    } else {
                        resolve({
                            success: false,
                            body: responseBody,
                            error: `HTTP ${res.statusCode}: ${responseBody}`,
                        });
                    }
                });
            });

            req.on('error', (err: Error) => {
                resolve({success: false, error: err.message});
            });

            req.end();
        });
    }

    /**
     * Make an HTTP PUT request.
     */
    private httpPut(
        host: string,
        port: number,
        path: string,
        body: string,
        headers: Record<string, string> = {},
    ): Promise<{success: boolean; body?: string; error?: string}> {
        return new Promise((resolve) => {
            const options = {
                hostname: host,
                port,
                path,
                method: 'PUT',
                headers: {
                    'Content-Length': Buffer.byteLength(body),
                    ...headers,
                },
            };

            const req = http.request(options, (res: IncomingMessage) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => {
                    responseBody += chunk.toString();
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({success: true, body: responseBody});
                    } else {
                        resolve({
                            success: false,
                            body: responseBody,
                            error: `HTTP ${res.statusCode}: ${responseBody}`,
                        });
                    }
                });
            });

            req.on('error', (err: Error) => {
                resolve({success: false, error: err.message});
            });

            req.write(body);
            req.end();
        });
    }
}
