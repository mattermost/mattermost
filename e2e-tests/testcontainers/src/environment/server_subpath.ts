// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StartedTestContainer} from 'testcontainers';

import {
    getMattermostImage,
    getNginxImage,
    getPostgresImage,
    getInbucketImage,
    DEFAULT_HA_SETTINGS,
    HA_NODE_COUNT,
    INTERNAL_PORTS,
} from '@/config';
import type {MattermostNodeConnectionInfo} from '@/config';
import {
    createMattermostContainer,
    getMattermostNodeConnectionInfo,
    generateNodeNames,
    createPostgresContainer,
    getPostgresConnectionInfo,
    createInbucketContainer,
    getInbucketConnectionInfo,
    createSubpathNginxContainer,
    getNginxConnectionInfo,
} from '@/containers';
import type {MattermostDependencies} from '@/containers';

import {MmctlClient} from './mmctl';
import {EnvironmentState, formatElapsed} from './types';

/**
 * Rewrite client asset paths inside a Mattermost container for subpath support.
 * Mattermost's client bundles (JS/CSS) have hardcoded root paths for static assets.
 * This command rewrites them to include the subpath prefix so the web app loads correctly.
 *
 * Uses `mmctl config subpath` which modifies files in the client assets directory.
 * Retries on transient Docker errors (container restarting, exec instance gone).
 * See: https://docs.mattermost.com/manage/mmctl-command-line-tool.html#mmctl-config-subpath
 */
async function rewriteSubpathAssets(
    container: StartedTestContainer,
    subpath: string,
    env: EnvironmentState,
    label: string,
): Promise<void> {
    const maxRetries = 4;
    const initialDelay = 500;
    const transientPatterns = [
        'no such exec',
        'no such container',
        'is not running',
        'is restarting',
        'container stopped',
    ];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await container.exec([
                'mmctl',
                'config',
                'subpath',
                '--assets-dir',
                '/mattermost/client',
                '--path',
                subpath,
            ]);

            if (result.exitCode !== 0) {
                env.log(`⚠ Failed to rewrite assets for ${label}: ${result.output}`);
            } else {
                env.log(`✓ ${label} assets rewritten for subpath ${subpath}`);
            }
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isTransient = transientPatterns.some((p) => message.includes(p));

            if (!isTransient || attempt === maxRetries) {
                throw error;
            }

            const delay = initialDelay * Math.pow(2, attempt);
            env.log(`⚠ Retrying asset rewrite for ${label} (attempt ${attempt + 1}/${maxRetries}): ${message}`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

/**
 * Start Mattermost in subpath mode (two servers behind nginx with /mattermost1 and /mattermost2).
 *
 * server1 (/mattermost1): Fully configurable. Uses shared dependencies from the main dependency loop.
 *   Supports --ha, -D, --admin, license, all mmctl configuration.
 * server2 (/mattermost2): Bare. Always single node. Independent postgres2 + inbucket2.
 *   Same Mattermost image but no admin, no license, no mmctl configuration.
 *
 * Flow:
 * 1. Create server2's independent deps (postgres2 + inbucket2 only)
 * 2. Prepare nginx aliases: server1 gets HA node aliases or single alias; server2 always single alias
 * 3. Start nginx with subpath routing
 * 4. Compute SiteURLs from nginx port
 * 5. Start server1: If --ha, start cluster nodes using shared deps + all -D env overrides + license.
 *    If single, start one node.
 * 6. Start server2: Always single node, uses postgres2/inbucket2, bare env (no license, no extra dep overrides)
 * 7. Rewrite assets on all server1 nodes + server2
 * 8. Configure server1 only via mmctl (full config: default test settings, LDAP, Elasticsearch, Redis, server config patch)
 * 9. Skip configuration for server2 — no mmctl commands at all
 * 10. Store connection info
 */
export async function startSubpathServer(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    if (!env.connectionInfo.postgres) throw new Error('PostgreSQL must be started first');

    const isHA = env.config.server.ha ?? false;
    const serverImage = env.config.server.image ?? getMattermostImage();

    env.log(`Starting Mattermost subpath mode (server1: ${isHA ? 'HA' : 'single'}, server2: bare)`);

    // Step 1: Create server2's independent deps (postgres2 + inbucket2)
    const depsStartTime = Date.now();
    env.log('Starting independent dependencies for server2...');

    const postgresImage = getPostgresImage();
    const inbucketImage = getInbucketImage();

    const [pgContainer2, ibContainer2] = await Promise.all([
        createPostgresContainer(env.network, {networkAlias: 'postgres2'}),
        createInbucketContainer(env.network, {networkAlias: 'inbucket2'}),
    ]);

    env.postgresContainer2 = pgContainer2;
    env.inbucketContainer2 = ibContainer2;

    const pgInfo2 = getPostgresConnectionInfo(pgContainer2, postgresImage);
    const ibInfo2 = getInbucketConnectionInfo(ibContainer2, inbucketImage);

    const depsElapsed = formatElapsed(Date.now() - depsStartTime);
    env.log(`✓ Server2 independent dependencies ready (${depsElapsed})`);

    // Step 2: Prepare nginx aliases
    // server1: HA node names or single alias; server2: always single alias
    let server1Aliases: string[];
    if (isHA) {
        server1Aliases = generateNodeNames(HA_NODE_COUNT);
    } else {
        server1Aliases = ['mattermost1'];
    }
    const server2Alias = 'mattermost2';

    // Step 3: Start nginx with subpath routing
    const nginxStartTime = Date.now();
    env.log('Starting nginx with subpath routing...');
    const nginxImage = getNginxImage();

    env.nginxContainer = await createSubpathNginxContainer(env.network, {
        server1Aliases,
        server2Alias,
    });

    const nginxInfo = getNginxConnectionInfo(env.nginxContainer, nginxImage);
    const nginxElapsed = formatElapsed(Date.now() - nginxStartTime);
    env.log(`✓ Nginx ready at ${nginxInfo.url} (${nginxElapsed})`);

    // Step 4: Compute SiteURLs from nginx external port
    const siteUrl1 = `${nginxInfo.url}/mattermost1`;
    const siteUrl2 = `${nginxInfo.url}/mattermost2`;

    // Step 5: Start server1
    // server1 uses shared deps from the main dependency loop and gets full env overrides + license
    const server1EnvOverrides = {
        ...env.buildEnvOverrides(),
        MM_SERVICESETTINGS_SITEURL: siteUrl1,
    };

    const server1Deps: MattermostDependencies = {
        postgres: env.connectionInfo.postgres,
        inbucket: env.connectionInfo.inbucket,
    };

    // Collect all server1 containers for asset rewriting
    const server1Containers: Array<{container: StartedTestContainer; label: string}> = [];

    if (isHA) {
        const clusterName = DEFAULT_HA_SETTINGS.clusterName;
        const nodeNames = generateNodeNames(HA_NODE_COUNT);
        const nodeInfos: MattermostNodeConnectionInfo[] = [];

        env.log(`Starting server1 HA cluster (${HA_NODE_COUNT} nodes, cluster: ${clusterName})`);

        for (const nodeName of nodeNames) {
            const nodeStartTime = Date.now();
            env.log(`Starting server1 ${nodeName}...`);

            const container = await createMattermostContainer(env.network, server1Deps, {
                image: env.config.server.image,
                envOverrides: server1EnvOverrides,
                imageMaxAgeMs: env.config.server.imageMaxAgeHours * 60 * 60 * 1000,
                subpath: '/mattermost1',
                cluster: {
                    enable: true,
                    clusterName,
                    nodeName,
                    networkAlias: nodeName,
                },
            });

            env.server1Nodes.set(nodeName, container);
            server1Containers.push({container, label: `server1-${nodeName}`});
            const nodeInfo = getMattermostNodeConnectionInfo(container, serverImage, nodeName, nodeName);
            nodeInfos.push(nodeInfo);

            const nodeElapsed = formatElapsed(Date.now() - nodeStartTime);
            env.log(`✓ server1 ${nodeName} ready at ${nodeInfo.url} (${nodeElapsed})`);
        }

        // Set server1 reference to leader node (used by getMmctl and stop)
        const leaderContainer = env.server1Nodes.get('leader');
        if (leaderContainer) {
            env.mattermostServer1 = leaderContainer;
        }

        // Store HA cluster info for server1
        env.connectionInfo.haCluster = {
            url: siteUrl1,
            nginx: nginxInfo,
            nodes: nodeInfos,
            clusterName,
        };
    } else {
        // Single server1 node
        const serverStartTime = Date.now();
        env.log('Starting server1...');

        const container = await createMattermostContainer(env.network, server1Deps, {
            image: env.config.server.image,
            envOverrides: server1EnvOverrides,
            imageMaxAgeMs: env.config.server.imageMaxAgeHours * 60 * 60 * 1000,
            subpath: '/mattermost1',
            cluster: {
                enable: false,
                clusterName: '',
                nodeName: 'server1',
                networkAlias: 'mattermost1',
            },
        });

        env.mattermostServer1 = container;
        server1Containers.push({container, label: 'server1'});

        const serverElapsed = formatElapsed(Date.now() - serverStartTime);
        const host = container.getHost();
        const port = container.getMappedPort(INTERNAL_PORTS.mattermost);
        env.log(`✓ server1 ready at http://${host}:${port} (${serverElapsed})`);
    }

    // Step 6: Start server2 — bare, always single node
    // server2 gets only basic env: postgres2, inbucket2, SiteURL. No license, no dep-specific env vars.
    const server2StartTime = Date.now();
    env.log('Starting server2 (bare)...');

    const server2Deps: MattermostDependencies = {
        postgres: pgInfo2,
        inbucket: ibInfo2,
        postgresNetworkAlias: 'postgres2',
        inbucketNetworkAlias: 'inbucket2',
    };

    // Bare env for server2: only essential settings, no license, no MM_* passthrough
    const server2Container = await createMattermostContainer(env.network, server2Deps, {
        image: env.config.server.image,
        envOverrides: {
            MM_SERVICESETTINGS_SITEURL: siteUrl2,
        },
        imageMaxAgeMs: env.config.server.imageMaxAgeHours * 60 * 60 * 1000,
        subpath: '/mattermost2',
        cluster: {
            enable: false,
            clusterName: '',
            nodeName: 'server2',
            networkAlias: server2Alias,
        },
    });

    env.mattermostServer2 = server2Container;

    const server2Elapsed = formatElapsed(Date.now() - server2StartTime);
    const server2Host = server2Container.getHost();
    const server2Port = server2Container.getMappedPort(INTERNAL_PORTS.mattermost);
    env.log(`✓ server2 (bare) ready at http://${server2Host}:${server2Port} (${server2Elapsed})`);

    // Verify containers
    if (!env.mattermostServer1 || !env.mattermostServer2) {
        throw new Error('Failed to start subpath servers');
    }

    // Compute direct URLs for connection info
    const server1Host = env.mattermostServer1.getHost();
    const server1Port = env.mattermostServer1.getMappedPort(INTERNAL_PORTS.mattermost);
    const server1DirectUrl = `http://${server1Host}:${server1Port}`;
    const server2DirectUrl = `http://${server2Host}:${server2Port}`;

    // Determine server1 internal URL based on mode
    const server1InternalUrl = isHA
        ? `http://leader:${INTERNAL_PORTS.mattermost}`
        : `http://mattermost1:${INTERNAL_PORTS.mattermost}`;

    // Store subpath connection info
    env.connectionInfo.subpath = {
        url: nginxInfo.url,
        server1Url: siteUrl1,
        server2Url: siteUrl2,
        server1DirectUrl,
        server2DirectUrl,
        nginx: nginxInfo,
        server1Postgres: env.connectionInfo.postgres,
        server1Inbucket: env.connectionInfo.inbucket!,
        server2Postgres: pgInfo2,
        server2Inbucket: ibInfo2,
        server1Mattermost: {
            host: server1Host,
            port: server1Port,
            url: server1DirectUrl,
            internalUrl: server1InternalUrl,
            image: serverImage,
        },
        server2Mattermost: {
            host: server2Host,
            port: server2Port,
            url: server2DirectUrl,
            internalUrl: `http://${server2Alias}:${INTERNAL_PORTS.mattermost}`,
            image: serverImage,
        },
    };

    // Step 7: Rewrite client assets for subpath on all server1 nodes + server2
    env.log('Rewriting client assets for subpath...');
    for (const {container, label} of server1Containers) {
        await rewriteSubpathAssets(container, '/mattermost1', env, label);
    }
    await rewriteSubpathAssets(env.mattermostServer2, '/mattermost2', env, 'server2');

    // Step 8: Configure server1 only via mmctl (full config)
    if (isHA) {
        // HA: configure via leader node
        const leaderContainer = env.server1Nodes.get('leader');
        if (leaderContainer) {
            const mmctl = new MmctlClient(leaderContainer);
            await env.configureServer(mmctl);
            env.log('✓ server1 (HA) configured via leader');
        }
    } else {
        const mmctl = new MmctlClient(env.mattermostServer1);
        await env.configureServer(mmctl);
        env.log('✓ server1 configured');
    }

    // Step 9: Skip configuration for server2 — no mmctl commands at all

    // Set mattermost info to server1 for backwards compatibility
    env.connectionInfo.mattermost = env.connectionInfo.subpath.server1Mattermost;

    const modeDesc = isHA ? `server1: HA ${HA_NODE_COUNT} nodes` : 'server1: single';
    env.log(`✓ Mattermost subpath mode ready (${modeDesc}, server2: bare)`);
}
