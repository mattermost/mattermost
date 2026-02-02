import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { KeycloakConnectionInfo } from '../config/types';
export interface KeycloakConfig {
    image?: string;
    adminUser?: string;
    adminPassword?: string;
}
export declare function createKeycloakContainer(network: StartedNetwork, config?: KeycloakConfig): Promise<StartedTestContainer>;
export declare function getKeycloakConnectionInfo(container: StartedTestContainer, image: string): KeycloakConnectionInfo;
