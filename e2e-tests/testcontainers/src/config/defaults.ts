// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DEFAULT_IMAGES} from './default_images';

export {DEFAULT_IMAGES};

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
    libretranslate: 'TC_LIBRETRANSLATE_IMAGE',
    nginx: 'TC_NGINX_IMAGE',
} as const;

/**
 * Get image for a service with environment variable override support.
 * @param service The service name
 * @returns The image to use (from env var or default)
 */
export function getServiceImage(service: string): string {
    const envVar = IMAGE_ENV_VARS[service as keyof typeof IMAGE_ENV_VARS];
    if (envVar && process.env[envVar]) {
        return process.env[envVar] as string;
    }
    const image = DEFAULT_IMAGES[service];
    if (!image) {
        throw new Error(`Unknown service image: ${service}`);
    }
    return image;
}

/**
 * Get Mattermost server image with environment variable override support.
 */
export function getMattermostImage(): string {
    return getServiceImage('mattermost');
}

/**
 * Get PostgreSQL image with environment variable override support.
 */
export function getPostgresImage(): string {
    return getServiceImage('postgres');
}

/**
 * Get Inbucket image with environment variable override support.
 */
export function getInbucketImage(): string {
    return getServiceImage('inbucket');
}

/**
 * Get OpenLDAP image with environment variable override support.
 */
export function getOpenLdapImage(): string {
    return getServiceImage('openldap');
}

/**
 * Get Keycloak image with environment variable override support.
 */
export function getKeycloakImage(): string {
    return getServiceImage('keycloak');
}

/**
 * Get MinIO image with environment variable override support.
 */
export function getMinioImage(): string {
    return getServiceImage('minio');
}

/**
 * Get Elasticsearch image with environment variable override support.
 */
export function getElasticsearchImage(): string {
    return getServiceImage('elasticsearch');
}

/**
 * Get OpenSearch image with environment variable override support.
 */
export function getOpenSearchImage(): string {
    return getServiceImage('opensearch');
}

/**
 * Get Redis image with environment variable override support.
 */
export function getRedisImage(): string {
    return getServiceImage('redis');
}

/**
 * Get Dejavu image with environment variable override support.
 */
export function getDejavuImage(): string {
    return getServiceImage('dejavu');
}

/**
 * Get Prometheus image with environment variable override support.
 */
export function getPrometheusImage(): string {
    return getServiceImage('prometheus');
}

/**
 * Get Grafana image with environment variable override support.
 */
export function getGrafanaImage(): string {
    return getServiceImage('grafana');
}

/**
 * Get Loki image with environment variable override support.
 */
export function getLokiImage(): string {
    return getServiceImage('loki');
}

/**
 * Get Promtail image with environment variable override support.
 */
export function getPromtailImage(): string {
    return getServiceImage('promtail');
}

/**
 * Get Nginx image with environment variable override support.
 */
export function getLibreTranslateImage(): string {
    return getServiceImage('libretranslate');
}

export function getNginxImage(): string {
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
} as const;

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
    libretranslate: 5000,
    nginx: 8065, // Load balancer port (same as mattermost)
} as const;

/**
 * Default cluster settings for HA mode
 */
export const DEFAULT_HA_SETTINGS = {
    clusterName: 'mm_test_cluster',
} as const;

/**
 * Fixed number of nodes for HA mode (not configurable)
 */
export const HA_NODE_COUNT = 3;
