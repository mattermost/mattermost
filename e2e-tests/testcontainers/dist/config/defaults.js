// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Default container images for all dependencies.
 * Centralized here for easy modification.
 *
 * These versions match server/build/docker-compose.common.yml
 */
export const DEFAULT_IMAGES = {
    // Container image under test - user configurable via SERVER_IMAGE env var
    mattermost: 'mattermostdevelopment/mattermost-enterprise-edition:master',
    // Database - version configurable via SERVICE_POSTGRES_IMAGE env var
    postgres: 'postgres:14',
    // Supporting dependencies (versions from server/build/docker-compose.common.yml)
    inbucket: 'inbucket/inbucket:stable',
    openldap: 'osixia/openldap:1.4.0',
    keycloak: 'quay.io/keycloak/keycloak:23.0.7',
    minio: 'minio/minio:RELEASE.2024-06-22T05-26-45Z',
    elasticsearch: 'mattermostdevelopment/mattermost-elasticsearch:8.9.0',
    opensearch: 'mattermostdevelopment/mattermost-opensearch:2.7.0',
    redis: 'redis:7.4.0',
    // Observability stack (versions from server/build/docker-compose.common.yml)
    dejavu: 'appbaseio/dejavu:3.4.2',
    prometheus: 'prom/prometheus:v2.46.0',
    grafana: 'grafana/grafana:10.4.2',
    loki: 'grafana/loki:3.0.0',
    promtail: 'grafana/promtail:3.0.0',
    // Load balancer for HA and subpath modes
    nginx: 'nginx:1.29.4',
};
/**
 * Environment variable names for image overrides.
 * Used by CI automation to test against different versions.
 * All prefixed with TC_ (testcontainers).
 *
 * Note: Mattermost server image is configured via TC_EDITION and TC_SERVER_TAG.
 */
export const IMAGE_ENV_VARS = {
    postgres: 'TC_POSTGRES_IMAGE',
    inbucket: 'TC_INBUCKET_IMAGE',
    openldap: 'TC_OPENLDAP_IMAGE',
    keycloak: 'TC_KEYCLOAK_IMAGE',
    minio: 'TC_MINIO_IMAGE',
    elasticsearch: 'TC_ELASTICSEARCH_IMAGE',
    opensearch: 'TC_OPENSEARCH_IMAGE',
    redis: 'TC_REDIS_IMAGE',
    dejavu: 'TC_DEJAVU_IMAGE',
    prometheus: 'TC_PROMETHEUS_IMAGE',
    grafana: 'TC_GRAFANA_IMAGE',
    loki: 'TC_LOKI_IMAGE',
    promtail: 'TC_PROMTAIL_IMAGE',
    nginx: 'TC_NGINX_IMAGE',
};
/**
 * Get image for a service with environment variable override support.
 * @param service The service name
 * @returns The image to use (from env var or default)
 */
export function getServiceImage(service) {
    const envVar = IMAGE_ENV_VARS[service];
    if (envVar && process.env[envVar]) {
        return process.env[envVar];
    }
    return DEFAULT_IMAGES[service];
}
/**
 * Get Mattermost server image with environment variable override support.
 */
export function getMattermostImage() {
    return getServiceImage('mattermost');
}
/**
 * Get PostgreSQL image with environment variable override support.
 */
export function getPostgresImage() {
    return getServiceImage('postgres');
}
/**
 * Get Inbucket image with environment variable override support.
 */
export function getInbucketImage() {
    return getServiceImage('inbucket');
}
/**
 * Get OpenLDAP image with environment variable override support.
 */
export function getOpenLdapImage() {
    return getServiceImage('openldap');
}
/**
 * Get Keycloak image with environment variable override support.
 */
export function getKeycloakImage() {
    return getServiceImage('keycloak');
}
/**
 * Get MinIO image with environment variable override support.
 */
export function getMinioImage() {
    return getServiceImage('minio');
}
/**
 * Get Elasticsearch image with environment variable override support.
 */
export function getElasticsearchImage() {
    return getServiceImage('elasticsearch');
}
/**
 * Get OpenSearch image with environment variable override support.
 */
export function getOpenSearchImage() {
    return getServiceImage('opensearch');
}
/**
 * Get Redis image with environment variable override support.
 */
export function getRedisImage() {
    return getServiceImage('redis');
}
/**
 * Get Dejavu image with environment variable override support.
 */
export function getDejavuImage() {
    return getServiceImage('dejavu');
}
/**
 * Get Prometheus image with environment variable override support.
 */
export function getPrometheusImage() {
    return getServiceImage('prometheus');
}
/**
 * Get Grafana image with environment variable override support.
 */
export function getGrafanaImage() {
    return getServiceImage('grafana');
}
/**
 * Get Loki image with environment variable override support.
 */
export function getLokiImage() {
    return getServiceImage('loki');
}
/**
 * Get Promtail image with environment variable override support.
 */
export function getPromtailImage() {
    return getServiceImage('promtail');
}
/**
 * Get Nginx image with environment variable override support.
 */
export function getNginxImage() {
    return getServiceImage('nginx');
}
/**
 * Default credentials for dependencies
 */
export const DEFAULT_CREDENTIALS = {
    postgres: {
        database: 'mattermost_test',
        username: 'mmuser',
        password: 'mostest',
    },
    minio: {
        accessKey: 'minioaccesskey',
        secretKey: 'miniosecretkey',
    },
    openldap: {
        adminPassword: 'mostest',
        domain: 'mm.test.com',
        organisation: 'Mattermost Test',
    },
    keycloak: {
        adminUser: 'admin',
        adminPassword: 'admin',
    },
    mattermost: {
        adminUsername: 'sysadmin',
        adminPassword: 'Sys@dmin-sample1',
        // Email is derived as '<username>@sample.mattermost.com'
    },
};
/**
 * Internal ports for dependencies (inside containers)
 */
export const INTERNAL_PORTS = {
    postgres: 5432,
    inbucket: {
        smtp: 10025,
        web: 9001,
        pop3: 10110,
    },
    openldap: {
        ldap: 389,
        ldaps: 636,
    },
    minio: {
        api: 9000,
        console: 9002,
    },
    elasticsearch: 9200,
    opensearch: 9200,
    redis: 6379,
    keycloak: 8080,
    mattermost: 8065,
    dejavu: 1358,
    prometheus: 9090,
    grafana: 3000,
    loki: 3100,
    promtail: 9080,
    nginx: 8065, // Load balancer port (same as mattermost)
};
/**
 * Default cluster settings for HA mode
 */
export const DEFAULT_HA_SETTINGS = {
    clusterName: 'mm_test_cluster',
};
/**
 * Fixed number of nodes for HA mode (not configurable)
 */
export const HA_NODE_COUNT = 3;
