// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
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
    getLibreTranslateImage,
} from '@/config';
import {
    createPostgresContainer,
    getPostgresConnectionInfo,
    createInbucketContainer,
    getInbucketConnectionInfo,
    createOpenLdapContainer,
    getOpenLdapConnectionInfo,
    createMinioContainer,
    getMinioConnectionInfo,
    createElasticsearchContainer,
    getElasticsearchConnectionInfo,
    createOpenSearchContainer,
    getOpenSearchConnectionInfo,
    createKeycloakContainer,
    getKeycloakConnectionInfo,
    createRedisContainer,
    getRedisConnectionInfo,
    createDejavuContainer,
    getDejavuConnectionInfo,
    createPrometheusContainer,
    getPrometheusConnectionInfo,
    createGrafanaContainer,
    getGrafanaConnectionInfo,
    createLokiContainer,
    getLokiConnectionInfo,
    createPromtailContainer,
    getPromtailConnectionInfo,
    createLibreTranslateContainer,
    getLibreTranslateConnectionInfo,
} from '@/containers';

import {EnvironmentState} from './types';

export type DependencyStarter = (env: EnvironmentState) => Promise<void>;

async function startPostgres(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getPostgresImage();
    env.postgresContainer = await createPostgresContainer(env.network);
    env.connectionInfo.postgres = getPostgresConnectionInfo(env.postgresContainer, image);
}

async function startInbucket(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getInbucketImage();
    env.inbucketContainer = await createInbucketContainer(env.network);
    env.connectionInfo.inbucket = getInbucketConnectionInfo(env.inbucketContainer, image);
}

async function startOpenLdap(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getOpenLdapImage();
    env.openldapContainer = await createOpenLdapContainer(env.network);
    env.connectionInfo.openldap = getOpenLdapConnectionInfo(env.openldapContainer, image);
}

async function startMinio(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getMinioImage();
    env.minioContainer = await createMinioContainer(env.network);
    env.connectionInfo.minio = getMinioConnectionInfo(env.minioContainer, image);
}

async function startElasticsearch(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getElasticsearchImage();
    env.elasticsearchContainer = await createElasticsearchContainer(env.network);
    env.connectionInfo.elasticsearch = getElasticsearchConnectionInfo(env.elasticsearchContainer, image);
}

async function startOpenSearch(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getOpenSearchImage();
    env.opensearchContainer = await createOpenSearchContainer(env.network);
    env.connectionInfo.opensearch = getOpenSearchConnectionInfo(env.opensearchContainer, image);
}

async function startKeycloak(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getKeycloakImage();
    env.keycloakContainer = await createKeycloakContainer(env.network);
    env.connectionInfo.keycloak = getKeycloakConnectionInfo(env.keycloakContainer, image);
}

async function startRedis(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getRedisImage();
    env.redisContainer = await createRedisContainer(env.network);
    env.connectionInfo.redis = getRedisConnectionInfo(env.redisContainer, image);
}

async function startDejavu(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getDejavuImage();
    env.dejavuContainer = await createDejavuContainer(env.network);
    env.connectionInfo.dejavu = getDejavuConnectionInfo(env.dejavuContainer, image);
}

async function startPrometheus(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getPrometheusImage();
    env.prometheusContainer = await createPrometheusContainer(env.network);
    env.connectionInfo.prometheus = getPrometheusConnectionInfo(env.prometheusContainer, image);
}

async function startGrafana(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getGrafanaImage();
    env.grafanaContainer = await createGrafanaContainer(env.network);
    env.connectionInfo.grafana = getGrafanaConnectionInfo(env.grafanaContainer, image);
}

async function startLoki(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getLokiImage();
    env.lokiContainer = await createLokiContainer(env.network);
    env.connectionInfo.loki = getLokiConnectionInfo(env.lokiContainer, image);
}

async function startPromtail(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getPromtailImage();
    env.promtailContainer = await createPromtailContainer(env.network);
    env.connectionInfo.promtail = getPromtailConnectionInfo(env.promtailContainer, image);
}

async function startLibreTranslate(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    const image = getLibreTranslateImage();
    env.libretranslateContainer = await createLibreTranslateContainer(env.network);
    env.connectionInfo.libretranslate = getLibreTranslateConnectionInfo(env.libretranslateContainer, image);
}

/**
 * Registry of dependency starters keyed by dependency name.
 */
export const dependencyStarters: Record<string, DependencyStarter> = {
    postgres: startPostgres,
    inbucket: startInbucket,
    openldap: startOpenLdap,
    minio: startMinio,
    elasticsearch: startElasticsearch,
    opensearch: startOpenSearch,
    keycloak: startKeycloak,
    redis: startRedis,
    dejavu: startDejavu,
    prometheus: startPrometheus,
    grafana: startGrafana,
    loki: startLoki,
    promtail: startPromtail,
    libretranslate: startLibreTranslate,
};

/**
 * Image getter functions keyed by dependency name (for pull-check logging).
 */
export const dependencyImages: Record<string, () => string> = {
    postgres: getPostgresImage,
    inbucket: getInbucketImage,
    openldap: getOpenLdapImage,
    minio: getMinioImage,
    elasticsearch: getElasticsearchImage,
    opensearch: getOpenSearchImage,
    keycloak: getKeycloakImage,
    redis: getRedisImage,
    dejavu: getDejavuImage,
    prometheus: getPrometheusImage,
    grafana: getGrafanaImage,
    loki: getLokiImage,
    promtail: getPromtailImage,
    libretranslate: getLibreTranslateImage,
};

/**
 * Ready-message templates keyed by dependency name.
 * Each takes the environment state and returns a log message.
 */
export const dependencyReadyMessages: Record<string, (env: EnvironmentState) => string> = {
    postgres: (env) => `PostgreSQL ready on port ${env.connectionInfo.postgres?.port}`,
    inbucket: (env) => `Inbucket ready on port ${env.connectionInfo.inbucket?.webPort}`,
    openldap: (env) => `OpenLDAP ready on port ${env.connectionInfo.openldap?.port}`,
    minio: (env) => `MinIO ready on port ${env.connectionInfo.minio?.port}`,
    elasticsearch: (env) => `Elasticsearch ready on port ${env.connectionInfo.elasticsearch?.port}`,
    opensearch: (env) => `OpenSearch ready on port ${env.connectionInfo.opensearch?.port}`,
    keycloak: (env) => `Keycloak ready on port ${env.connectionInfo.keycloak?.port}`,
    redis: (env) => `Redis ready on port ${env.connectionInfo.redis?.port}`,
    dejavu: (env) => `Dejavu ready on port ${env.connectionInfo.dejavu?.port}`,
    prometheus: (env) => `Prometheus ready on port ${env.connectionInfo.prometheus?.port}`,
    grafana: (env) => `Grafana ready on port ${env.connectionInfo.grafana?.port}`,
    loki: (env) => `Loki ready on port ${env.connectionInfo.loki?.port}`,
    promtail: (env) => `Promtail ready on port ${env.connectionInfo.promtail?.port}`,
    libretranslate: (env) => `LibreTranslate ready on port ${env.connectionInfo.libretranslate?.port}`,
};
