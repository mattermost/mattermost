// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {StartedNetwork, StartedTestContainer} from 'testcontainers';
import {StartedPostgreSqlContainer} from '@testcontainers/postgresql';

import type {DependencyConnectionInfo, ResolvedTestcontainersConfig} from '@/config';

/**
 * Server mode for the environment.
 * - 'container': Run Mattermost in a Docker container (default)
 * - 'local': Connect to a locally running Mattermost server (dependencies only)
 */
export type ServerMode = 'container' | 'local';

/**
 * Shared mutable state for the environment, exposed to extracted module functions.
 * The MattermostTestEnvironment class implements this interface.
 */
export interface EnvironmentState {
    config: ResolvedTestcontainersConfig;
    serverMode: ServerMode;
    network: StartedNetwork | null;

    // Container references
    postgresContainer: StartedPostgreSqlContainer | null;
    inbucketContainer: StartedTestContainer | null;
    openldapContainer: StartedTestContainer | null;
    minioContainer: StartedTestContainer | null;
    elasticsearchContainer: StartedTestContainer | null;
    opensearchContainer: StartedTestContainer | null;
    keycloakContainer: StartedTestContainer | null;
    redisContainer: StartedTestContainer | null;
    dejavuContainer: StartedTestContainer | null;
    prometheusContainer: StartedTestContainer | null;
    grafanaContainer: StartedTestContainer | null;
    lokiContainer: StartedTestContainer | null;
    promtailContainer: StartedTestContainer | null;
    libretranslateContainer: StartedTestContainer | null;
    mattermostContainer: StartedTestContainer | null;

    // HA mode containers
    nginxContainer: StartedTestContainer | null;
    mattermostNodes: Map<string, StartedTestContainer>;

    // Subpath mode containers
    postgresContainer2: StartedPostgreSqlContainer | null;
    inbucketContainer2: StartedTestContainer | null;
    mattermostServer1: StartedTestContainer | null;
    mattermostServer2: StartedTestContainer | null;
    server1Nodes: Map<string, StartedTestContainer>;

    // Connection info cache
    connectionInfo: Partial<DependencyConnectionInfo>;

    log(message: string): void;
    buildEnvOverrides(): Record<string, string>;
    configureServer(mmctl: import('./mmctl').MmctlClient): Promise<void>;
    loadLdapTestData(): Promise<void>;
}

/**
 * Format elapsed time in a human-readable format.
 * Shows decimal if < 10s, whole seconds if < 60s, otherwise minutes and seconds.
 */
export function formatElapsed(ms: number): string {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 10) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    if (totalSeconds < 60) {
        return `${Math.round(totalSeconds)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
}
