import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { MattermostConnectionInfo, MattermostNodeConnectionInfo, PostgresConnectionInfo, InbucketConnectionInfo } from '../config/types';
export interface MattermostConfig {
    image?: string;
    envOverrides?: Record<string, string>;
    /**
     * Maximum age for the image before forcing a pull (in milliseconds).
     * Only applies to Mattermost images with :master tag.
     * Default: 24 hours. Set to 0 to always pull, or Infinity to never force pull.
     */
    imageMaxAgeMs?: number;
    /**
     * Additional files to copy into the container.
     * Useful for SAML certificates, custom config files, etc.
     */
    filesToCopy?: Array<{
        content: string;
        target: string;
    }>;
    /**
     * Cluster configuration for HA mode.
     * When provided, the container will be configured as a cluster node.
     */
    cluster?: {
        /** Whether clustering is enabled */
        enable: boolean;
        /** Cluster name */
        clusterName: string;
        /** Node name (e.g., 'leader', 'follower', 'follower2') */
        nodeName: string;
        /** Network alias for this node */
        networkAlias: string;
    };
    /**
     * Subpath for the server (e.g., '/mattermost1').
     * When set, the health check URL is adjusted to include the subpath.
     */
    subpath?: string;
}
export interface MattermostDependencies {
    postgres: PostgresConnectionInfo;
    inbucket?: InbucketConnectionInfo;
}
export declare function createMattermostContainer(network: StartedNetwork, deps: MattermostDependencies, config?: MattermostConfig): Promise<StartedTestContainer>;
export declare function getMattermostConnectionInfo(container: StartedTestContainer, image: string): MattermostConnectionInfo;
/**
 * Get connection info for a Mattermost cluster node in HA mode.
 */
export declare function getMattermostNodeConnectionInfo(container: StartedTestContainer, image: string, nodeName: string, networkAlias: string): MattermostNodeConnectionInfo;
/**
 * Generate node names for HA cluster.
 * Returns ['leader', 'follower', 'follower2'] for 3 nodes, etc.
 */
export declare function generateNodeNames(nodeCount: number): string[];
