import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { ElasticsearchConnectionInfo } from '../config/types';
export interface ElasticsearchConfig {
    image?: string;
}
export declare function createElasticsearchContainer(network: StartedNetwork, config?: ElasticsearchConfig): Promise<StartedTestContainer>;
export declare function getElasticsearchConnectionInfo(container: StartedTestContainer, image: string): ElasticsearchConnectionInfo;
