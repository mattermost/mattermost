import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { PrometheusConnectionInfo } from '../config/types';
export interface PrometheusConfig {
    image?: string;
}
export declare function createPrometheusContainer(network: StartedNetwork, config?: PrometheusConfig): Promise<StartedTestContainer>;
export declare function getPrometheusConnectionInfo(container: StartedTestContainer, image: string): PrometheusConnectionInfo;
