import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { DejavuConnectionInfo } from '../config/types';
export interface DejavuConfig {
    image?: string;
}
export declare function createDejavuContainer(network: StartedNetwork, config?: DejavuConfig): Promise<StartedTestContainer>;
export declare function getDejavuConnectionInfo(container: StartedTestContainer, image: string): DejavuConnectionInfo;
