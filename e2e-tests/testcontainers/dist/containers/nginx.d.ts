import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { NginxConnectionInfo } from '../config/types';
export interface NginxConfig {
    image?: string;
    /** Network aliases of Mattermost nodes to load balance */
    nodeAliases: string[];
}
export interface SubpathNginxConfig {
    image?: string;
    /** Network aliases of Mattermost server 1 nodes */
    server1Aliases: string[];
    /** Network aliases of Mattermost server 2 nodes */
    server2Aliases: string[];
}
export declare function createNginxContainer(network: StartedNetwork, config: NginxConfig): Promise<StartedTestContainer>;
export declare function createSubpathNginxContainer(network: StartedNetwork, config: SubpathNginxConfig): Promise<StartedTestContainer>;
export declare function getNginxConnectionInfo(container: StartedTestContainer, image: string): NginxConnectionInfo;
