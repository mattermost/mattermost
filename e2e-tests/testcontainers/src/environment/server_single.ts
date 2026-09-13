// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getMattermostImage} from '@/config';
import {createMattermostContainer, getMattermostConnectionInfo} from '@/containers';
import type {MattermostDependencies} from '@/containers';

import {MmctlClient} from './mmctl';
import {EnvironmentState, formatElapsed} from './types';

/**
 * Start a single Mattermost server node.
 */
export async function startSingleServer(env: EnvironmentState): Promise<void> {
    if (!env.network) throw new Error('Network not initialized');
    if (!env.connectionInfo.postgres) throw new Error('PostgreSQL must be started first');

    const deps: MattermostDependencies = {
        postgres: env.connectionInfo.postgres,
        inbucket: env.connectionInfo.inbucket,
    };

    const envOverrides = env.buildEnvOverrides();

    const serverImage = env.config.server.image ?? getMattermostImage();
    const mmStartTime = Date.now();
    env.log(`Starting Mattermost (${serverImage})`);

    env.mattermostContainer = await createMattermostContainer(env.network, deps, {
        image: env.config.server.image,
        envOverrides,
        imageMaxAgeMs: env.config.server.imageMaxAgeHours * 60 * 60 * 1000,
    });
    env.connectionInfo.mattermost = getMattermostConnectionInfo(env.mattermostContainer, serverImage);
    const mmElapsed = formatElapsed(Date.now() - mmStartTime);
    env.log(`✓ Mattermost ready at ${env.connectionInfo.mattermost.url} (${mmElapsed})`);

    // Update SiteURL to use the actual mapped port
    const mmctl = new MmctlClient(env.mattermostContainer);
    const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${env.connectionInfo.mattermost.url}"`);
    if (siteUrlResult.exitCode !== 0) {
        env.log(`⚠ Failed to set SiteURL: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
    }

    // Configure server via mmctl (LDAP, Elasticsearch, Redis, server config)
    await env.configureServer(mmctl);
}
