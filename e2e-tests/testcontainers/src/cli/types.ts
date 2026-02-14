// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Container info structure from .tc.docker.json
 */
export interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    host: string;
    port: number;
    url: string;
    internalUrl: string;
    labels?: Record<string, string>;
}

/**
 * Docker info file structure
 */
export interface DockerInfo {
    startedAt: string;
    containers: Record<string, ContainerInfo | undefined>;
}

/**
 * CLI options for the start command
 */
export interface StartOptions {
    config?: string;
    edition?: string;
    tag?: string;
    serviceEnv?: string;
    env?: string[];
    envFile?: string;
    deps?: string;
    depsOnly?: boolean;
    ha?: boolean;
    subpath?: boolean;
    entry?: boolean;
    esr?: boolean;
    admin?: boolean | string;
    adminPassword?: string;
    outputDir: string;
}

/**
 * CLI options with output directory
 */
export interface OutputDirOptions {
    outputDir: string;
}

/**
 * CLI options for upgrade command
 */
export interface UpgradeOptions extends OutputDirOptions {
    tag: string;
}
