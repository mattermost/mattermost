// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getOpenSearchImage, INTERNAL_PORTS} from '../config/defaults';
import {OpenSearchConnectionInfo} from '../config/types';
import {createFileLogConsumer} from '../utils/log';

export interface OpenSearchConfig {
    image?: string;
}

export async function createOpenSearchContainer(
    network: StartedNetwork,
    config: OpenSearchConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getOpenSearchImage();

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('opensearch')
        .withEnvironment({
            'http.host': '0.0.0.0',
            'http.cors.enabled': 'true',
            'http.cors.allow-origin': 'http://localhost:1358,http://127.0.0.1:1358',
            'http.cors.allow-headers': 'X-Requested-With,X-Auth-Token,Content-Type,Content-Length,Authorization',
            'http.cors.allow-credentials': 'true',
            'transport.host': '127.0.0.1',
            'discovery.type': 'single-node',
            'plugins.security.disabled': 'true',
            ES_JAVA_OPTS: '-Xms512m -Xmx512m',
        })
        .withExposedPorts(INTERNAL_PORTS.opensearch)
        .withLogConsumer(createFileLogConsumer('opensearch'))
        .withWaitStrategy(Wait.forHttp('/_cluster/health', INTERNAL_PORTS.opensearch).withStartupTimeout(120_000))
        .start();

    return container;
}

export function getOpenSearchConnectionInfo(container: StartedTestContainer, image: string): OpenSearchConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.opensearch);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
