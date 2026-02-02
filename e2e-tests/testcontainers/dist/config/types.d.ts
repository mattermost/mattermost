/**
 * Connection information for subpath servers
 */
export interface SubpathConnectionInfo {
    /** Nginx load balancer URL (main entry point) */
    url: string;
    /** Server 1 subpath URL */
    server1Url: string;
    /** Server 2 subpath URL */
    server2Url: string;
    /** Server 1 direct URL (bypass nginx) */
    server1DirectUrl: string;
    /** Server 2 direct URL (bypass nginx) */
    server2DirectUrl: string;
    /** Nginx connection info */
    nginx: NginxConnectionInfo;
}
/**
 * Connection information for PostgreSQL
 */
export interface PostgresConnectionInfo {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    connectionString: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Inbucket
 */
export interface InbucketConnectionInfo {
    host: string;
    smtpPort: number;
    webPort: number;
    pop3Port: number;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for OpenLDAP
 */
export interface OpenLdapConnectionInfo {
    host: string;
    port: number;
    tlsPort: number;
    baseDN: string;
    bindDN: string;
    bindPassword: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for MinIO
 */
export interface MinioConnectionInfo {
    host: string;
    /** S3 API port */
    port: number;
    /** Web console port */
    consolePort: number;
    accessKey: string;
    secretKey: string;
    /** S3 API endpoint URL */
    endpoint: string;
    /** Web console URL */
    consoleUrl: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Elasticsearch
 */
export interface ElasticsearchConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for OpenSearch
 */
export interface OpenSearchConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Keycloak
 */
export interface KeycloakConnectionInfo {
    host: string;
    port: number;
    adminUrl: string;
    realmUrl: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Redis
 */
export interface RedisConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Mattermost server
 */
export interface MattermostConnectionInfo {
    host: string;
    port: number;
    url: string;
    internalUrl: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for a Mattermost node in HA mode
 */
export interface MattermostNodeConnectionInfo extends MattermostConnectionInfo {
    /** Node name (leader, follower, follower2, etc.) */
    nodeName: string;
    /** Network alias for this node */
    networkAlias: string;
}
/**
 * Connection information for nginx load balancer (HA mode)
 */
export interface NginxConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for HA cluster
 */
export interface HAClusterConnectionInfo {
    /** Load balancer URL (main entry point) */
    url: string;
    /** Load balancer connection info */
    nginx: NginxConnectionInfo;
    /** All Mattermost nodes in the cluster */
    nodes: MattermostNodeConnectionInfo[];
    /** Cluster name */
    clusterName: string;
}
/**
 * Connection information for Dejavu (Elasticsearch UI)
 */
export interface DejavuConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Prometheus
 */
export interface PrometheusConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Grafana
 */
export interface GrafanaConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Loki
 */
export interface LokiConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * Connection information for Promtail
 */
export interface PromtailConnectionInfo {
    host: string;
    port: number;
    url: string;
    /** The Docker image used for this container */
    image: string;
}
/**
 * All service connection information
 */
export interface DependencyConnectionInfo {
    postgres: PostgresConnectionInfo;
    inbucket?: InbucketConnectionInfo;
    openldap?: OpenLdapConnectionInfo;
    minio?: MinioConnectionInfo;
    elasticsearch?: ElasticsearchConnectionInfo;
    opensearch?: OpenSearchConnectionInfo;
    keycloak?: KeycloakConnectionInfo;
    redis?: RedisConnectionInfo;
    mattermost?: MattermostConnectionInfo;
    dejavu?: DejavuConnectionInfo;
    prometheus?: PrometheusConnectionInfo;
    grafana?: GrafanaConnectionInfo;
    loki?: LokiConnectionInfo;
    promtail?: PromtailConnectionInfo;
    /** HA cluster info (only present when ha mode is enabled) */
    haCluster?: HAClusterConnectionInfo;
    /** Subpath info (only present when subpath mode is enabled) */
    subpath?: SubpathConnectionInfo;
}
/**
 * Docker container metadata
 */
export interface ContainerMetadata {
    /** Container ID (full SHA) */
    id: string;
    /** Container name */
    name: string;
    /** Docker image used */
    image: string;
    /** Container labels */
    labels: Record<string, string>;
}
/**
 * All container metadata by service name
 */
export interface ContainerMetadataMap {
    postgres?: ContainerMetadata;
    inbucket?: ContainerMetadata;
    openldap?: ContainerMetadata;
    minio?: ContainerMetadata;
    elasticsearch?: ContainerMetadata;
    opensearch?: ContainerMetadata;
    keycloak?: ContainerMetadata;
    redis?: ContainerMetadata;
    mattermost?: ContainerMetadata;
    dejavu?: ContainerMetadata;
    prometheus?: ContainerMetadata;
    grafana?: ContainerMetadata;
    loki?: ContainerMetadata;
    promtail?: ContainerMetadata;
    /** Nginx load balancer (HA mode only) */
    nginx?: ContainerMetadata;
    /** HA cluster nodes (leader, follower, follower2, etc.) */
    [key: `mattermost-${string}`]: ContainerMetadata | undefined;
}
