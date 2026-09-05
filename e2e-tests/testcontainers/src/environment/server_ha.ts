// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getMattermostImage, getNginxImage, DEFAULT_HA_SETTINGS, HA_NODE_COUNT} from '@/config';
import type {MattermostNodeConnectionInfo} from '@/config';
import {
    createMattermostContainer,
    getMattermostNodeConnectionInfo,
    generateNodeNames,
    createNginxContainer,
    getNginxConnectionInfo,
} from '@/containers';
import type {MattermostDependencies} from '@/containers';

import {MmctlClient} from './mmctl';
import {EnvironmentState, formatElapsed} from './types';

/**
 * Start Mattermost in HA mode (multi-node cluster with nginx load balancer).
 */
export async function startHAServer(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    if (!env.connectionInfo.postgres) throw new Error('PostgreSQL must be started first');

    const clusterName = DEFAULT_HA_SETTINGS.clusterName;
    const nodeNames = generateNodeNames(HA_NODE_COUNT);
    const serverImage = env.config.server.image ?? getMattermostImage();

    env.log(`Starting Mattermost HA cluster (${HA_NODE_COUNT} nodes, cluster: ${clusterName})`);

    const deps: MattermostDependencies = {
        postgres: env.connectionInfo.postgres,
        inbucket: env.connectionInfo.inbucket,
    };

    const envOverrides = env.buildEnvOverrides();

    // Start all Mattermost nodes in sequence (leader first, then followers)
    const nodeInfos: MattermostNodeConnectionInfo[] = [];

    for (let i = 0; i < nodeNames.length; i++) {
        const nodeName = nodeNames[i];
        const nodeStartTime = Date.now();
        env.log(`Starting Mattermost ${nodeName}...`);

        const container = await createMattermostContainer(env.network, deps, {
            image: env.config.server.image,
            envOverrides,
            imageMaxAgeMs: env.config.server.imageMaxAgeHours * 60 * 60 * 1000,
            cluster: {
                enable: true,
                clusterName,
                nodeName,
                networkAlias: nodeName,
            },
        });

        env.mattermostNodes.set(nodeName, container);
        const nodeInfo = getMattermostNodeConnectionInfo(container, serverImage, nodeName, nodeName);
        nodeInfos.push(nodeInfo);

        const nodeElapsed = formatElapsed(Date.now() - nodeStartTime);
        env.log(`✓ Mattermost ${nodeName} ready at ${nodeInfo.url} (${nodeElapsed})`);
    }

    // Start nginx load balancer
    const nginxStartTime = Date.now();
    env.log('Starting nginx load balancer...');
    const nginxImage = getNginxImage();

    env.nginxContainer = await createNginxContainer(env.network, {
        nodeAliases: nodeNames,
    });

    const nginxInfo = getNginxConnectionInfo(env.nginxContainer, nginxImage);
    const nginxElapsed = formatElapsed(Date.now() - nginxStartTime);
    env.log(`✓ Nginx load balancer ready at ${nginxInfo.url} (${nginxElapsed})`);

    // Store HA cluster connection info
    env.connectionInfo.haCluster = {
        url: nginxInfo.url,
        nginx: nginxInfo,
        nodes: nodeInfos,
        clusterName,
    };

    // Set mattermost info to leader node so getServerUrl() works in HA mode
    env.connectionInfo.mattermost = nodeInfos[0];

    // Configure the cluster via mmctl on the leader node
    const leaderContainer = env.mattermostNodes.get('leader');
    if (leaderContainer) {
        const mmctl = new MmctlClient(leaderContainer);

        // Set SiteURL to the load balancer URL
        const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${nginxInfo.url}"`);
        if (siteUrlResult.exitCode !== 0) {
            env.log(`⚠ Failed to set SiteURL: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
        }

        // Configure server via mmctl (LDAP, Elasticsearch, Redis, server config)
        await env.configureServer(mmctl);
    }

    env.log(`✓ Mattermost HA cluster ready (${HA_NODE_COUNT} nodes)`);
}
