// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// config
export {defineConfig, discoverAndLoadConfig, getEditionImage, DEFAULT_ADMIN, DEFAULT_OUTPUT_DIR} from './config';
export type {MattermostEdition, ResolvedTestcontainersConfig, ServiceEnvironment} from './config';

// defaults
export {
    DEFAULT_CREDENTIALS,
    DEFAULT_HA_SETTINGS,
    HA_NODE_COUNT,
    INTERNAL_PORTS,
    getDejavuImage,
    getElasticsearchImage,
    getGrafanaImage,
    getInbucketImage,
    getKeycloakImage,
    getLibreTranslateImage,
    getLokiImage,
    getMattermostImage,
    getMinioImage,
    getNginxImage,
    getOpenLdapImage,
    getOpenSearchImage,
    getPostgresImage,
    getPrometheusImage,
    getPromtailImage,
    getRedisImage,
} from './defaults';

// types
export type {
    ContainerMetadata,
    ContainerMetadataMap,
    DependencyConnectionInfo,
    DejavuConnectionInfo,
    ElasticsearchConnectionInfo,
    GrafanaConnectionInfo,
    HAClusterConnectionInfo,
    InbucketConnectionInfo,
    KeycloakConnectionInfo,
    LibreTranslateConnectionInfo,
    LokiConnectionInfo,
    MattermostConnectionInfo,
    MattermostNodeConnectionInfo,
    MinioConnectionInfo,
    NginxConnectionInfo,
    OpenLdapConnectionInfo,
    OpenSearchConnectionInfo,
    PostgresConnectionInfo,
    PrometheusConnectionInfo,
    PromtailConnectionInfo,
    RedisConnectionInfo,
    SubpathConnectionInfo,
} from './types';

// esr
export {ESR_SERVER_TAG} from './esr';
