import { StartedTestContainer, StartedNetwork } from 'testcontainers';
import { OpenLdapConnectionInfo } from '../config/types';
export interface OpenLdapConfig {
    image?: string;
    adminPassword?: string;
    domain?: string;
    organisation?: string;
}
export declare function createOpenLdapContainer(network: StartedNetwork, config?: OpenLdapConfig): Promise<StartedTestContainer>;
export declare function getOpenLdapConnectionInfo(container: StartedTestContainer, image: string): OpenLdapConnectionInfo;
