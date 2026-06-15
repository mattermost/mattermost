// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Main environment class
export {MattermostTestEnvironment} from './environment';

// Configuration
export {defineConfig, discoverAndLoadConfig} from './config';
export type {
    DependencyConnectionInfo,
    HAClusterConnectionInfo,
    ResolvedTestcontainersConfig,
    SubpathConnectionInfo,
} from './config';
