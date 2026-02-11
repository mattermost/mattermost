// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StartedTestContainer} from 'testcontainers';
import {StartedPostgreSqlContainer} from '@testcontainers/postgresql';

import {getPostgresImage, getInbucketImage} from '@/config';
import type {ContainerMetadata, ContainerMetadataMap} from '@/config';

import {EnvironmentState} from './types';

/**
 * Extract metadata from a container.
 */
export function getContainerMetadataFrom(
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
export function getContainerMetadata(env: EnvironmentState): ContainerMetadataMap {
    const metadata: ContainerMetadataMap = {};

    if (env.postgresContainer && env.connectionInfo.postgres) {
        metadata.postgres = getContainerMetadataFrom(env.postgresContainer, env.connectionInfo.postgres.image);
    }
    if (env.inbucketContainer && env.connectionInfo.inbucket) {
        metadata.inbucket = getContainerMetadataFrom(env.inbucketContainer, env.connectionInfo.inbucket.image);
    }
    if (env.openldapContainer && env.connectionInfo.openldap) {
        metadata.openldap = getContainerMetadataFrom(env.openldapContainer, env.connectionInfo.openldap.image);
    }
    if (env.minioContainer && env.connectionInfo.minio) {
        metadata.minio = getContainerMetadataFrom(env.minioContainer, env.connectionInfo.minio.image);
    }
    if (env.elasticsearchContainer && env.connectionInfo.elasticsearch) {
        metadata.elasticsearch = getContainerMetadataFrom(
            env.elasticsearchContainer,
            env.connectionInfo.elasticsearch.image,
        );
    }
    if (env.opensearchContainer && env.connectionInfo.opensearch) {
        metadata.opensearch = getContainerMetadataFrom(env.opensearchContainer, env.connectionInfo.opensearch.image);
    }
    if (env.keycloakContainer && env.connectionInfo.keycloak) {
        metadata.keycloak = getContainerMetadataFrom(env.keycloakContainer, env.connectionInfo.keycloak.image);
    }
    if (env.redisContainer && env.connectionInfo.redis) {
        metadata.redis = getContainerMetadataFrom(env.redisContainer, env.connectionInfo.redis.image);
    }
    if (env.mattermostContainer && env.connectionInfo.mattermost) {
        metadata.mattermost = getContainerMetadataFrom(env.mattermostContainer, env.connectionInfo.mattermost.image);
    } else if (env.connectionInfo.mattermost && env.connectionInfo.haCluster) {
        // In HA mode, mattermost info points to the leader node but env.mattermostContainer is null.
        // Use the leader node container from mattermostNodes map instead.
        const leaderContainer = env.mattermostNodes.get('leader');
        if (leaderContainer) {
            metadata.mattermost = getContainerMetadataFrom(leaderContainer, env.connectionInfo.mattermost.image);
        }
    }
    if (env.dejavuContainer && env.connectionInfo.dejavu) {
        metadata.dejavu = getContainerMetadataFrom(env.dejavuContainer, env.connectionInfo.dejavu.image);
    }
    if (env.prometheusContainer && env.connectionInfo.prometheus) {
        metadata.prometheus = getContainerMetadataFrom(env.prometheusContainer, env.connectionInfo.prometheus.image);
    }
    if (env.grafanaContainer && env.connectionInfo.grafana) {
        metadata.grafana = getContainerMetadataFrom(env.grafanaContainer, env.connectionInfo.grafana.image);
    }
    if (env.lokiContainer && env.connectionInfo.loki) {
        metadata.loki = getContainerMetadataFrom(env.lokiContainer, env.connectionInfo.loki.image);
    }
    if (env.promtailContainer && env.connectionInfo.promtail) {
        metadata.promtail = getContainerMetadataFrom(env.promtailContainer, env.connectionInfo.promtail.image);
    }
    if (env.libretranslateContainer && env.connectionInfo.libretranslate) {
        metadata.libretranslate = getContainerMetadataFrom(
            env.libretranslateContainer,
            env.connectionInfo.libretranslate.image,
        );
    }

    // HA mode containers
    if (env.nginxContainer && env.connectionInfo.haCluster) {
        metadata.nginx = getContainerMetadataFrom(env.nginxContainer, env.connectionInfo.haCluster.nginx.image);
    }
    if (env.connectionInfo.haCluster) {
        for (const nodeInfo of env.connectionInfo.haCluster.nodes) {
            const container = env.mattermostNodes.get(nodeInfo.nodeName);
            if (container) {
                metadata[`mattermost-${nodeInfo.nodeName}`] = getContainerMetadataFrom(container, nodeInfo.image);
            }
        }
    }

    // Subpath mode independent dependency containers (server2)
    if (env.postgresContainer2) {
        metadata.postgres2 = getContainerMetadataFrom(env.postgresContainer2, getPostgresImage());
    }
    if (env.inbucketContainer2) {
        metadata.inbucket2 = getContainerMetadataFrom(env.inbucketContainer2, getInbucketImage());
    }

    // Subpath mode containers
    if (env.nginxContainer && env.connectionInfo.subpath) {
        metadata.nginx = getContainerMetadataFrom(env.nginxContainer, env.connectionInfo.subpath.nginx.image);
    }

    // Subpath server1 nodes (HA mode)
    if (env.server1Nodes.size > 0 && env.connectionInfo.subpath) {
        for (const [nodeName, container] of env.server1Nodes) {
            metadata[`mattermost-server1-${nodeName}`] = getContainerMetadataFrom(
                container,
                env.connectionInfo.subpath.server1Mattermost.image,
            );
        }
    } else if (env.mattermostServer1 && env.connectionInfo.subpath) {
        // Subpath single server1
        metadata['mattermost-server1'] = getContainerMetadataFrom(
            env.mattermostServer1,
            env.connectionInfo.subpath.server1Mattermost.image,
        );
    }
    if (env.mattermostServer2 && env.connectionInfo.subpath) {
        metadata['mattermost-server2'] = getContainerMetadataFrom(
            env.mattermostServer2,
            env.connectionInfo.subpath.server2Mattermost.image,
        );
    }
    return metadata;
}
