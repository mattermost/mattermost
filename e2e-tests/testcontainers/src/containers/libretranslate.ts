// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getLibreTranslateImage, INTERNAL_PORTS} from '@/config';
import type {LibreTranslateConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

export interface LibreTranslateConfig {
    image?: string;
    networkAlias?: string;
}

export async function createLibreTranslateContainer(
    network: StartedNetwork,
    config: LibreTranslateConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getLibreTranslateImage();

    const alias = config.networkAlias ?? 'libretranslate';

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases(alias)
        .withExposedPorts(INTERNAL_PORTS.libretranslate)
        .withLogConsumer(createFileLogConsumer(alias))
        .withWaitStrategy(Wait.forHttp('/languages', INTERNAL_PORTS.libretranslate).forStatusCode(200))
        .withStartupTimeout(120_000)
        .start();

    return container;
}

export function getLibreTranslateConnectionInfo(
    container: StartedTestContainer,
    image: string,
): LibreTranslateConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.libretranslate);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
