// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getLokiImage, INTERNAL_PORTS} from '@/config';
import type {LokiConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

export interface LokiConfig {
    image?: string;
}

export async function createLokiContainer(
    network: StartedNetwork,
    config: LokiConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getLokiImage();

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('loki')
        .withExposedPorts(INTERNAL_PORTS.loki)
        .withLogConsumer(createFileLogConsumer('loki'))
        .withWaitStrategy(Wait.forHttp('/ready', INTERNAL_PORTS.loki).withStartupTimeout(60_000))
        .start();

    return container;
}

export function getLokiConnectionInfo(container: StartedTestContainer, image: string): LokiConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.loki);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
