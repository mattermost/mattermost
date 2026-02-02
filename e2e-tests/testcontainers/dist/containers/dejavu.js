// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { GenericContainer, Wait } from 'testcontainers';
import { getDejavuImage, INTERNAL_PORTS } from '../config/defaults';
import { createFileLogConsumer } from '../utils/log';
export async function createDejavuContainer(network, config = {}) {
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
export function getDejavuConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.dejavu);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
