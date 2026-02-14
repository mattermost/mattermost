// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getDejavuImage, INTERNAL_PORTS} from '@/config';
import type {DejavuConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

export interface DejavuConfig {
    image?: string;
}

export async function createDejavuContainer(
    network: StartedNetwork,
    config: DejavuConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getDejavuImage();

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('dejavu')
        .withExposedPorts(INTERNAL_PORTS.dejavu)
        .withLogConsumer(createFileLogConsumer('dejavu'))
        .withWaitStrategy(Wait.forListeningPorts())
        .withStartupTimeout(60_000)
        .start();

    return container;
}

export function getDejavuConnectionInfo(container: StartedTestContainer, image: string): DejavuConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.dejavu);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
