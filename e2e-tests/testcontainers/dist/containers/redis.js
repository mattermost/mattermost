// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { GenericContainer, Wait } from 'testcontainers';
import { getRedisImage, INTERNAL_PORTS } from '../config/defaults';
import { createFileLogConsumer } from '../utils/log';
export async function createRedisContainer(network, config = {}) {
    const image = config.image ?? getRedisImage();
    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('redis')
        .withExposedPorts(INTERNAL_PORTS.redis)
        .withLogConsumer(createFileLogConsumer('redis'))
        .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
        .withStartupTimeout(30_000)
        .start();
    return container;
}
export function getRedisConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.redis);
    return {
        host,
        port,
        url: `redis://${host}:${port}`,
        image,
    };
}
