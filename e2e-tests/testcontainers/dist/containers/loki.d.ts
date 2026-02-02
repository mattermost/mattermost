import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { LokiConnectionInfo } from '../config/types';
export interface LokiConfig {
    image?: string;
}
export declare function createLokiContainer(network: StartedNetwork, config?: LokiConfig): Promise<StartedTestContainer>;
export declare function getLokiConnectionInfo(container: StartedTestContainer, image: string): LokiConnectionInfo;
