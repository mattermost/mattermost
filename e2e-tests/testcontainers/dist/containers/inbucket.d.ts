import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { InbucketConnectionInfo } from '../config/types';
export interface InbucketConfig {
    image?: string;
}
export declare function createInbucketContainer(network: StartedNetwork, config?: InbucketConfig): Promise<StartedTestContainer>;
export declare function getInbucketConnectionInfo(container: StartedTestContainer, image: string): InbucketConnectionInfo;
