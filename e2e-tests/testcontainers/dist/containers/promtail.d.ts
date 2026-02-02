import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { PromtailConnectionInfo } from '../config/types';
export interface PromtailConfig {
    image?: string;
}
export declare function createPromtailContainer(network: StartedNetwork, config?: PromtailConfig): Promise<StartedTestContainer>;
export declare function getPromtailConnectionInfo(container: StartedTestContainer, image: string): PromtailConnectionInfo;
