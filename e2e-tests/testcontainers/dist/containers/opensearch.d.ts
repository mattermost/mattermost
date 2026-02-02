import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { OpenSearchConnectionInfo } from '../config/types';
export interface OpenSearchConfig {
    image?: string;
}
export declare function createOpenSearchContainer(network: StartedNetwork, config?: OpenSearchConfig): Promise<StartedTestContainer>;
export declare function getOpenSearchConnectionInfo(container: StartedTestContainer, image: string): OpenSearchConnectionInfo;
