import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedNetwork } from 'testcontainers';
import { PostgresConnectionInfo } from '../config/types';
export interface PostgresConfig {
    image?: string;
    database?: string;
    username?: string;
    password?: string;
}
export declare function createPostgresContainer(network: StartedNetwork, config?: PostgresConfig): Promise<StartedPostgreSqlContainer>;
export declare function getPostgresConnectionInfo(container: StartedPostgreSqlContainer, image: string): PostgresConnectionInfo;
