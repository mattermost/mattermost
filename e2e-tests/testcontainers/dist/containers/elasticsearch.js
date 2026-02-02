// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { GenericContainer, Wait } from 'testcontainers';
import { getElasticsearchImage, INTERNAL_PORTS } from '../config/defaults';
import { createFileLogConsumer } from '../utils/log';
export async function createElasticsearchContainer(network, config = {}) {
    const image = config.image ?? getElasticsearchImage();
    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('elasticsearch')
        .withEnvironment({
        'http.host': '0.0.0.0',
        'http.port': String(INTERNAL_PORTS.elasticsearch),
        'http.cors.enabled': 'true',
        'http.cors.allow-origin': 'http://localhost:1358,http://127.0.0.1:1358',
        'http.cors.allow-headers': 'X-Requested-With,X-Auth-Token,Content-Type,Content-Length,Authorization',
        'http.cors.allow-credentials': 'true',
        'transport.host': '127.0.0.1',
        'xpack.security.enabled': 'false',
        'action.destructive_requires_name': 'false',
        ES_JAVA_OPTS: '-Xms512m -Xmx512m',
    })
        .withExposedPorts(INTERNAL_PORTS.elasticsearch)
        .withLogConsumer(createFileLogConsumer('elasticsearch'))
        .withWaitStrategy(Wait.forHttp('/_cluster/health', INTERNAL_PORTS.elasticsearch))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
export function getElasticsearchConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.elasticsearch);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
