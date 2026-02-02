/**
 * Default container images for all dependencies.
 * Centralized here for easy modification.
 *
 * These versions match server/build/docker-compose.common.yml
 */
export declare const DEFAULT_IMAGES: {
    readonly mattermost: "mattermostdevelopment/mattermost-enterprise-edition:master";
    readonly postgres: "postgres:14";
    readonly inbucket: "inbucket/inbucket:stable";
    readonly openldap: "osixia/openldap:1.4.0";
    readonly keycloak: "quay.io/keycloak/keycloak:23.0.7";
    readonly minio: "minio/minio:RELEASE.2024-06-22T05-26-45Z";
    readonly elasticsearch: "mattermostdevelopment/mattermost-elasticsearch:8.9.0";
    readonly opensearch: "mattermostdevelopment/mattermost-opensearch:2.7.0";
    readonly redis: "redis:7.4.0";
    readonly dejavu: "appbaseio/dejavu:3.4.2";
    readonly prometheus: "prom/prometheus:v2.46.0";
    readonly grafana: "grafana/grafana:10.4.2";
    readonly loki: "grafana/loki:3.0.0";
    readonly promtail: "grafana/promtail:3.0.0";
    readonly nginx: "nginx:1.29.4";
};
/**
 * Environment variable names for image overrides.
 * Used by CI automation to test against different versions.
 * All prefixed with TC_ (testcontainers).
 *
 * Note: Mattermost server image is configured via TC_EDITION and TC_SERVER_TAG.
 */
export declare const IMAGE_ENV_VARS: {
    readonly postgres: "TC_POSTGRES_IMAGE";
    readonly inbucket: "TC_INBUCKET_IMAGE";
    readonly openldap: "TC_OPENLDAP_IMAGE";
    readonly keycloak: "TC_KEYCLOAK_IMAGE";
    readonly minio: "TC_MINIO_IMAGE";
    readonly elasticsearch: "TC_ELASTICSEARCH_IMAGE";
    readonly opensearch: "TC_OPENSEARCH_IMAGE";
    readonly redis: "TC_REDIS_IMAGE";
    readonly dejavu: "TC_DEJAVU_IMAGE";
    readonly prometheus: "TC_PROMETHEUS_IMAGE";
    readonly grafana: "TC_GRAFANA_IMAGE";
    readonly loki: "TC_LOKI_IMAGE";
    readonly promtail: "TC_PROMTAIL_IMAGE";
    readonly nginx: "TC_NGINX_IMAGE";
};
/**
 * Get image for a service with environment variable override support.
 * @param service The service name
 * @returns The image to use (from env var or default)
 */
export declare function getServiceImage(service: keyof typeof DEFAULT_IMAGES): string;
/**
 * Get Mattermost server image with environment variable override support.
 */
export declare function getMattermostImage(): string;
/**
 * Get PostgreSQL image with environment variable override support.
 */
export declare function getPostgresImage(): string;
/**
 * Get Inbucket image with environment variable override support.
 */
export declare function getInbucketImage(): string;
/**
 * Get OpenLDAP image with environment variable override support.
 */
export declare function getOpenLdapImage(): string;
/**
 * Get Keycloak image with environment variable override support.
 */
export declare function getKeycloakImage(): string;
/**
 * Get MinIO image with environment variable override support.
 */
export declare function getMinioImage(): string;
/**
 * Get Elasticsearch image with environment variable override support.
 */
export declare function getElasticsearchImage(): string;
/**
 * Get OpenSearch image with environment variable override support.
 */
export declare function getOpenSearchImage(): string;
/**
 * Get Redis image with environment variable override support.
 */
export declare function getRedisImage(): string;
/**
 * Get Dejavu image with environment variable override support.
 */
export declare function getDejavuImage(): string;
/**
 * Get Prometheus image with environment variable override support.
 */
export declare function getPrometheusImage(): string;
/**
 * Get Grafana image with environment variable override support.
 */
export declare function getGrafanaImage(): string;
/**
 * Get Loki image with environment variable override support.
 */
export declare function getLokiImage(): string;
/**
 * Get Promtail image with environment variable override support.
 */
export declare function getPromtailImage(): string;
/**
 * Get Nginx image with environment variable override support.
 */
export declare function getNginxImage(): string;
/**
 * Default credentials for dependencies
 */
export declare const DEFAULT_CREDENTIALS: {
    readonly postgres: {
        readonly database: "mattermost_test";
        readonly username: "mmuser";
        readonly password: "mostest";
    };
    readonly minio: {
        readonly accessKey: "minioaccesskey";
        readonly secretKey: "miniosecretkey";
    };
    readonly openldap: {
        readonly adminPassword: "mostest";
        readonly domain: "mm.test.com";
        readonly organisation: "Mattermost Test";
    };
    readonly keycloak: {
        readonly adminUser: "admin";
        readonly adminPassword: "admin";
    };
    readonly mattermost: {
        readonly adminUsername: "sysadmin";
        readonly adminPassword: "Sys@dmin-sample1";
    };
};
/**
 * Internal ports for dependencies (inside containers)
 */
export declare const INTERNAL_PORTS: {
    readonly postgres: 5432;
    readonly inbucket: {
        readonly smtp: 10025;
        readonly web: 9001;
        readonly pop3: 10110;
    };
    readonly openldap: {
        readonly ldap: 389;
        readonly ldaps: 636;
    };
    readonly minio: {
        readonly api: 9000;
        readonly console: 9002;
    };
    readonly elasticsearch: 9200;
    readonly opensearch: 9200;
    readonly redis: 6379;
    readonly keycloak: 8080;
    readonly mattermost: 8065;
    readonly dejavu: 1358;
    readonly prometheus: 9090;
    readonly grafana: 3000;
    readonly loki: 3100;
    readonly promtail: 9080;
    readonly nginx: 8065;
};
/**
 * Default cluster settings for HA mode
 */
export declare const DEFAULT_HA_SETTINGS: {
    readonly clusterName: "mm_test_cluster";
};
/**
 * Fixed number of nodes for HA mode (not configurable)
 */
export declare const HA_NODE_COUNT = 3;
