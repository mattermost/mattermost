import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { MinioConnectionInfo } from '../config/types';
export interface MinioConfig {
    image?: string;
    accessKey?: string;
    secretKey?: string;
}
export declare function createMinioContainer(network: StartedNetwork, config?: MinioConfig): Promise<StartedTestContainer>;
export declare function getMinioConnectionInfo(container: StartedTestContainer, image: string): MinioConnectionInfo;
