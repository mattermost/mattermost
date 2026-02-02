import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { GrafanaConnectionInfo } from '../config/types';
export interface GrafanaConfig {
    image?: string;
}
export declare function createGrafanaContainer(network: StartedNetwork, config?: GrafanaConfig): Promise<StartedTestContainer>;
export declare function getGrafanaConnectionInfo(container: StartedTestContainer, image: string): GrafanaConnectionInfo;
