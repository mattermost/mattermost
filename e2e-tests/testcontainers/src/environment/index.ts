// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Disable Ryuk (testcontainers cleanup container) so containers persist after CLI exits.
// Containers should only be cleaned up via `mattermost-testcontainers stop`.
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

import {Network, StartedNetwork, StartedTestContainer} from 'testcontainers';
import {StartedPostgreSqlContainer} from '@testcontainers/postgresql';

import type {
    DependencyConnectionInfo,
    HAClusterConnectionInfo,
    ResolvedTestcontainersConfig,
    SubpathConnectionInfo,
} from '@/config';
import {imageExistsLocally, log, printConnectionInfo as printConnectionInfoFn, setOutputDir} from '@/utils';

import {MmctlClient} from './mmctl';
import {buildBaseEnvOverrides, configureServerViaMmctl as configureServerViaMmctlFn} from './server_config';
import {ServerMode, EnvironmentState, formatElapsed} from './types';
import {validateDependencies} from './validation';
import {dependencyStarters, dependencyImages, dependencyReadyMessages} from './dependencies';
import {startSingleServer} from './server_single';
import {startHAServer} from './server_ha';
import {startSubpathServer} from './server_subpath';
import {uploadSamlIdpCertificate as uploadSamlIdpCertificateFn} from './saml';

const DEFAULT_DEPENDENCIES = ['postgres', 'inbucket'];

/**
 * MattermostTestEnvironment orchestrates all test containers for E2E testing.
 * It manages the lifecycle of containers and provides connection information.
 */
export class MattermostTestEnvironment implements EnvironmentState {
    config: ResolvedTestcontainersConfig;
    serverMode: ServerMode;
    network: StartedNetwork | null = null;

    // Container references
    postgresContainer: StartedPostgreSqlContainer | null = null;
    inbucketContainer: StartedTestContainer | null = null;
    openldapContainer: StartedTestContainer | null = null;
    minioContainer: StartedTestContainer | null = null;
    elasticsearchContainer: StartedTestContainer | null = null;
    opensearchContainer: StartedTestContainer | null = null;
    keycloakContainer: StartedTestContainer | null = null;
    redisContainer: StartedTestContainer | null = null;
    dejavuContainer: StartedTestContainer | null = null;
    prometheusContainer: StartedTestContainer | null = null;
    grafanaContainer: StartedTestContainer | null = null;
    lokiContainer: StartedTestContainer | null = null;
    promtailContainer: StartedTestContainer | null = null;
    libretranslateContainer: StartedTestContainer | null = null;
    mattermostContainer: StartedTestContainer | null = null;

    // HA mode containers
    nginxContainer: StartedTestContainer | null = null;
    mattermostNodes: Map<string, StartedTestContainer> = new Map();

    // Subpath mode containers
    postgresContainer2: StartedPostgreSqlContainer | null = null;
    inbucketContainer2: StartedTestContainer | null = null;
    mattermostServer1: StartedTestContainer | null = null;
    mattermostServer2: StartedTestContainer | null = null;
    server1Nodes: Map<string, StartedTestContainer> = new Map();

    // Connection info cache
    connectionInfo: Partial<DependencyConnectionInfo> = {};

    /**
     * Create a new MattermostTestEnvironment.
     * @param config Resolved testcontainers configuration
     * @param serverMode Server mode: 'container' (default) or 'local'
     */
    constructor(config: ResolvedTestcontainersConfig, serverMode: ServerMode = 'container') {
        this.config = config;
        this.serverMode = serverMode;
    }

    /**
     * Start all enabled dependencies and the Mattermost server.
     */
    async start(): Promise<void> {
        // Set output directory from config
        setOutputDir(this.config.outputDir);

        const startTime = Date.now();
        if (this.serverMode === 'local') {
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

        // Ensure required dependencies (postgres, inbucket) are always included
        const REQUIRED_DEPS = ['postgres', 'inbucket'];
        const configuredDeps = this.config.dependencies ?? DEFAULT_DEPENDENCIES;
        const dependencies = [...new Set([...REQUIRED_DEPS, ...configuredDeps])];
        this.log(`Enabled dependencies: ${dependencies.join(', ')}`);

        // Validate dependency combinations
        validateDependencies(dependencies, this.config);

        // Start all dependencies in parallel
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

        for (const dep of dependencies) {
            const starter = dependencyStarters[dep];
            const getImage = dependencyImages[dep];
            const getReadyMessage = dependencyReadyMessages[dep];
            if (!starter || !getImage || !getReadyMessage) continue;

            const image = getImage();
            const serviceStartTime = Date.now();
            const needsPull = !imageExistsLocally(image);
            if (needsPull) {
                this.log(`Pulling image ${image}`);
            }
            pendingDeps.add(dep);
            parallelDeps.push(
                starter(this).then(() => {
                    pendingDeps.delete(dep);
                    const elapsed = formatElapsed(Date.now() - serviceStartTime);
                    this.log(`✓ ${getReadyMessage(this)} (${elapsed})`);
                }),
            );
        }

        if (parallelDeps.length > 0) {
            this.log(`Starting dependencies: ${dependencies.join(', ')}`);
            await Promise.all(parallelDeps);
        }

        clearInterval(progressInterval);

        // Start Mattermost server (depends on postgres and optionally inbucket)
        if (this.serverMode === 'container') {
            if (this.config.server.subpath) {
                await startSubpathServer(this);
            } else if (this.config.server.ha) {
                await startHAServer(this);
            } else {
                await startSingleServer(this);
            }
        }

        const elapsed = formatElapsed(Date.now() - startTime);
        this.log(`✓ Test environment ready in ${elapsed}`);
    }

    log(message: string): void {
        log(message);
    }

    /**
     * Build base environment overrides for Mattermost containers.
     * Delegates to the standalone buildBaseEnvOverrides function.
     */
    buildEnvOverrides(): Record<string, string> {
        return buildBaseEnvOverrides(this.connectionInfo, this.config, this.serverMode);
    }

    /**
     * Configure server via mmctl after it's running.
     * Delegates to the standalone configureServerViaMmctl function.
     */
    async configureServer(mmctl: MmctlClient): Promise<void> {
        await configureServerViaMmctlFn(
            mmctl,
            this.connectionInfo,
            this.config,
            (msg) => this.log(msg),
            () => this.loadLdapTestData(),
        );
    }

    /**
     * Load LDAP test data (schemas and users) into the OpenLDAP container.
     * This mirrors what server/Makefile does in start-docker-openldap-test-data.
     */
    async loadLdapTestData(): Promise<void> {
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
        for (const [nodeName, container] of this.server1Nodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost server1-${nodeName} stopped`)));
        }
        if (this.mattermostServer1 && this.server1Nodes.size === 0) {
            // Only stop mattermostServer1 directly if it's not already covered by server1Nodes
            stopPromises.push(this.mattermostServer1.stop().then(() => this.log('Mattermost server1 stopped')));
        }
        if (this.mattermostServer2) {
            stopPromises.push(this.mattermostServer2.stop().then(() => this.log('Mattermost server2 stopped')));
        }
        if (this.postgresContainer2) {
            stopPromises.push(this.postgresContainer2.stop().then(() => this.log('PostgreSQL 2 stopped')));
        }
        if (this.inbucketContainer2) {
            stopPromises.push(this.inbucketContainer2.stop().then(() => this.log('Inbucket 2 stopped')));
        }

        // Stop containers in reverse order
        if (this.mattermostContainer) {
            stopPromises.push(this.mattermostContainer.stop().then(() => this.log('Mattermost stopped')));
        }
        if (this.libretranslateContainer) {
            stopPromises.push(this.libretranslateContainer.stop().then(() => this.log('LibreTranslate stopped')));
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
        this.libretranslateContainer = null;
        this.mattermostContainer = null;
        this.nginxContainer = null;
        this.mattermostNodes.clear();
        this.postgresContainer2 = null;
        this.inbucketContainer2 = null;
        this.mattermostServer1 = null;
        this.mattermostServer2 = null;
        this.server1Nodes.clear();
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
     * Print connection information for all dependencies to console.
     */
    printConnectionInfo(): void {
        const info = this.getConnectionInfo();
        printConnectionInfoFn(info);
    }

    /**
     * Get the MmctlClient for executing mmctl commands.
     * In HA mode, connects to the leader node.
     * In subpath mode, connects to server1 (leader node if HA).
     */
    getMmctl(): MmctlClient {
        // In subpath mode, use server1 (leader if HA)
        if (this.config.server.subpath) {
            const server1Leader = this.server1Nodes.get('leader');
            if (server1Leader) {
                return new MmctlClient(server1Leader);
            }
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
        if (this.serverMode === 'local') {
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
     * In subpath mode, creates the admin on server1 only (server2 is bare).
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

        const username = this.config.admin.username;
        const password = this.config.admin.password || 'Sys@dmin-sample1';
        const email = `${username}@sample.mattermost.com`;
        const command = `user create --email "${email}" --username "${username}" --password "${password}" --system-admin`;

        // All modes (single, HA, subpath, subpath+HA): create on one server (shared database)
        // In subpath mode, only server1 gets an admin — server2 is bare.
        const mmctl = this.getMmctl();
        const createResult = await mmctl.exec(command);

        if (createResult.exitCode !== 0 && !createResult.stdout.includes('already exists')) {
            this.log(`⚠ Failed to create admin user: ${createResult.stdout || createResult.stderr}`);
            return {success: false, error: `Failed to create admin user: ${createResult.stdout}`};
        }

        this.log(`✓ Admin user created: ${username} / ${password} (${email})`);
        return {success: true, username, password, email};
    }

    /**
     * Upload SAML IDP certificate and configure SAML settings for Keycloak.
     * This fully configures SAML authentication with Keycloak.
     * @returns Result object with success status and optional error message
     */
    async uploadSamlIdpCertificate(): Promise<{success: boolean; error?: string}> {
        return uploadSamlIdpCertificateFn(this);
    }
}
