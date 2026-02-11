// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Default container images for all dependencies.
 * These versions match server/build/docker-compose.common.yml.
 * Override at runtime via environment variables (TC_*_IMAGE) or CLI flags.
 *
 * @see https://github.com/mattermost/mattermost/blob/master/server/build/docker-compose.common.yml
 */
export const DEFAULT_IMAGES: Record<string, string> = {
    // Mattermost server (configurable via TC_EDITION and TC_SERVER_TAG)
    mattermost: 'mattermostdevelopment/mattermost-enterprise-edition:master',

    // Database
    postgres: 'postgres:14',

    // Supporting dependencies
    inbucket: 'inbucket/inbucket:stable',
    openldap: 'osixia/openldap:1.4.0',
    keycloak: 'quay.io/keycloak/keycloak:23.0.7',
    minio: 'minio/minio:RELEASE.2024-06-22T05-26-45Z',
    elasticsearch: 'mattermostdevelopment/mattermost-elasticsearch:8.9.0',
    opensearch: 'mattermostdevelopment/mattermost-opensearch:2.7.0',
    redis: 'redis:7.4.0',

    // Observability stack
    dejavu: 'appbaseio/dejavu:3.4.2',
    prometheus: 'prom/prometheus:v2.46.0',
    grafana: 'grafana/grafana:10.4.2',
    loki: 'grafana/loki:3.0.0',
    promtail: 'grafana/promtail:3.0.0',

    // Translation service
    libretranslate: 'libretranslate/libretranslate:v1.8.4',

    // Load balancer (HA and subpath modes)
    nginx: 'nginx:1.29.4',
};
