// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Main environment class
export {MattermostTestEnvironment} from './environment';

// MmctlClient for executing mmctl commands
export {MmctlClient, MmctlExecResult} from './mmctl';

// Configuration types
export {
    EnvironmentConfig,
    PostgresConnectionInfo,
    InbucketConnectionInfo,
    OpenLdapConnectionInfo,
    MinioConnectionInfo,
    ElasticsearchConnectionInfo,
    OpenSearchConnectionInfo,
    KeycloakConnectionInfo,
    RedisConnectionInfo,
    MattermostConnectionInfo,
    MattermostNodeConnectionInfo,
    NginxConnectionInfo,
    HAClusterConnectionInfo,
    SubpathConnectionInfo,
    DejavuConnectionInfo,
    PrometheusConnectionInfo,
    GrafanaConnectionInfo,
    LokiConnectionInfo,
    PromtailConnectionInfo,
    DependencyConnectionInfo,
    ContainerMetadata,
    ContainerMetadataMap,
} from './config/types';

// Default configuration values
export {
    DEFAULT_IMAGES,
    DEFAULT_CREDENTIALS,
    INTERNAL_PORTS,
    IMAGE_ENV_VARS,
    DEFAULT_HA_SETTINGS,
    HA_NODE_COUNT,
    getMattermostImage,
    getPostgresImage,
    getOpenSearchImage,
    getNginxImage,
    getServiceImage,
} from './config/defaults';

// Testcontainers configuration system
export {
    // Types
    MattermostEdition,
    MattermostImageConfig,
    TestcontainersConfig,
    TestcontainersImages,
    ResolvedMattermostServer,
    ResolvedTestcontainersConfig,
    DiscoverConfigOptions,
    // Config helper (recommended)
    defineConfig,
    // Constants
    DEFAULT_CONFIG,
    DEFAULT_SERVER_TAG,
    DEFAULT_OUTPUT_DIR,
    MATTERMOST_EDITION_IMAGES,
    // Functions
    resolveConfig,
    applyConfigToEnv,
    logConfig,
    loadConfigFile,
    discoverAndLoadConfig,
} from './config/config';

// Output directory and logging utilities
export {getOutputDir, setOutputDir, getLogDir, setLogDir} from './utils/log';

// Print utilities
export {
    printConnectionInfo,
    printServerEnvVars,
    buildServerEnvVars,
    buildDockerInfo,
    writeEnvFile,
    writeServerConfig,
    writeDockerInfo,
    writeKeycloakCertificate,
    writeOpenLdapSetup,
    writeKeycloakSetup,
} from './utils/print';

// Docker utilities
export {imageExistsLocally, pullImageIfNeeded} from './utils/docker';

// Individual container creators for advanced use cases
export {createPostgresContainer, getPostgresConnectionInfo, PostgresConfig} from './containers/postgres';
export {createInbucketContainer, getInbucketConnectionInfo, InbucketConfig} from './containers/inbucket';
export {createOpenLdapContainer, getOpenLdapConnectionInfo, OpenLdapConfig} from './containers/openldap';
export {createMinioContainer, getMinioConnectionInfo, MinioConfig} from './containers/minio';
export {
    createElasticsearchContainer,
    getElasticsearchConnectionInfo,
    ElasticsearchConfig,
} from './containers/elasticsearch';
export {createOpenSearchContainer, getOpenSearchConnectionInfo, OpenSearchConfig} from './containers/opensearch';
export {createKeycloakContainer, getKeycloakConnectionInfo, KeycloakConfig} from './containers/keycloak';
export {createRedisContainer, getRedisConnectionInfo, RedisConfig} from './containers/redis';
export {createDejavuContainer, getDejavuConnectionInfo, DejavuConfig} from './containers/dejavu';
export {createPrometheusContainer, getPrometheusConnectionInfo, PrometheusConfig} from './containers/prometheus';
export {createGrafanaContainer, getGrafanaConnectionInfo, GrafanaConfig} from './containers/grafana';
export {createLokiContainer, getLokiConnectionInfo, LokiConfig} from './containers/loki';
export {createPromtailContainer, getPromtailConnectionInfo, PromtailConfig} from './containers/promtail';
export {
    createMattermostContainer,
    getMattermostConnectionInfo,
    getMattermostNodeConnectionInfo,
    generateNodeNames,
    MattermostConfig,
    MattermostDependencies,
} from './containers/mattermost';
export {
    createNginxContainer,
    createSubpathNginxContainer,
    getNginxConnectionInfo,
    NginxConfig,
    SubpathNginxConfig,
} from './containers/nginx';
