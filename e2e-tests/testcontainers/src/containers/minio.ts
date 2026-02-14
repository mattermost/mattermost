// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getMinioImage, DEFAULT_CREDENTIALS, INTERNAL_PORTS} from '@/config';
import type {MinioConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

export interface MinioConfig {
    image?: string;
    accessKey?: string;
    secretKey?: string;
}

export async function createMinioContainer(
    network: StartedNetwork,
    config: MinioConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getMinioImage();
    const accessKey = config.accessKey ?? DEFAULT_CREDENTIALS.minio.accessKey;
    const secretKey = config.secretKey ?? DEFAULT_CREDENTIALS.minio.secretKey;

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('minio')
        .withEnvironment({
            MINIO_ROOT_USER: accessKey,
            MINIO_ROOT_PASSWORD: secretKey,
        })
        .withCommand(['server', '/data', '--console-address', `:${INTERNAL_PORTS.minio.console}`])
        .withExposedPorts(INTERNAL_PORTS.minio.api, INTERNAL_PORTS.minio.console)
        .withLogConsumer(createFileLogConsumer('minio'))
        .withWaitStrategy(Wait.forHttp('/minio/health/ready', INTERNAL_PORTS.minio.api))
        .withStartupTimeout(60_000)
        .start();

    return container;
}

export function getMinioConnectionInfo(container: StartedTestContainer, image: string): MinioConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.minio.api);
    const consolePort = container.getMappedPort(INTERNAL_PORTS.minio.console);

    return {
        host,
        port,
        consolePort,
        accessKey: DEFAULT_CREDENTIALS.minio.accessKey,
        secretKey: DEFAULT_CREDENTIALS.minio.secretKey,
        endpoint: `http://${host}:${port}`,
        consoleUrl: `http://${host}:${consolePort}`,
        image,
    };
}
