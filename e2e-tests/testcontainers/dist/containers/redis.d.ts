import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { RedisConnectionInfo } from '../config/types';
export interface RedisConfig {
    image?: string;
}
export declare function createRedisContainer(network: StartedNetwork, config?: RedisConfig): Promise<StartedTestContainer>;
export declare function getRedisConnectionInfo(container: StartedTestContainer, image: string): RedisConnectionInfo;
