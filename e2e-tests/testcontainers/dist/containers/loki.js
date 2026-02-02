// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { GenericContainer, Wait } from 'testcontainers';
import { getLokiImage, INTERNAL_PORTS } from '../config/defaults';
import { createFileLogConsumer } from '../utils/log';
export async function createLokiContainer(network, config = {}) {
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
export function getLokiConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.loki);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
