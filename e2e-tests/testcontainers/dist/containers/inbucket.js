// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { GenericContainer, Wait } from 'testcontainers';
import { getInbucketImage, INTERNAL_PORTS } from '../config/defaults';
import { createFileLogConsumer } from '../utils/log';
export async function createInbucketContainer(network, config = {}) {
    const image = config.image ?? getInbucketImage();
    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('inbucket')
        .withEnvironment({
        INBUCKET_WEB_ADDR: `0.0.0.0:${INTERNAL_PORTS.inbucket.web}`,
        INBUCKET_POP3_ADDR: `0.0.0.0:${INTERNAL_PORTS.inbucket.pop3}`,
        INBUCKET_SMTP_ADDR: `0.0.0.0:${INTERNAL_PORTS.inbucket.smtp}`,
    })
        .withExposedPorts(INTERNAL_PORTS.inbucket.web, INTERNAL_PORTS.inbucket.smtp, INTERNAL_PORTS.inbucket.pop3)
        .withLogConsumer(createFileLogConsumer('inbucket'))
        .withWaitStrategy(Wait.forLogMessage(/SMTP listening/i))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
export function getInbucketConnectionInfo(container, image) {
    const host = container.getHost();
    return {
        host,
        smtpPort: container.getMappedPort(INTERNAL_PORTS.inbucket.smtp),
        webPort: container.getMappedPort(INTERNAL_PORTS.inbucket.web),
        pop3Port: container.getMappedPort(INTERNAL_PORTS.inbucket.pop3),
        image,
    };
}
