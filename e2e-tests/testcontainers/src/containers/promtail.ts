// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getPromtailImage, INTERNAL_PORTS} from '@/config';
import type {PromtailConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

// Promtail configuration for collecting logs and sending to Loki
const PROMTAIL_CONFIG = `
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: mattermost
    pipeline_stages:
      - match:
          selector: '{job="mattermost"}'
          stages:
            - json:
                expressions:
                  timestamp: timestamp
                  level: level
      - labels:
          level:
      - timestamp:
          format: '2006-01-02 15:04:05.999 -07:00'
          source: timestamp
    static_configs:
    - targets:
        - localhost
      labels:
        job: mattermost
        app: mattermost
        __path__: /logs/*.log
`;

export interface PromtailConfig {
    image?: string;
}

export async function createPromtailContainer(
    network: StartedNetwork,
    config: PromtailConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getPromtailImage();

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('promtail')
        .withCopyContentToContainer([{content: PROMTAIL_CONFIG, target: '/etc/promtail/config.yaml'}])
        .withCommand(['-config.file=/etc/promtail/config.yaml'])
        .withExposedPorts(INTERNAL_PORTS.promtail)
        .withLogConsumer(createFileLogConsumer('promtail'))
        // Use port check instead of /ready endpoint (which requires Loki connectivity)
        .withWaitStrategy(Wait.forListeningPorts())
        .withStartupTimeout(60_000)
        .start();

    return container;
}

export function getPromtailConnectionInfo(container: StartedTestContainer, image: string): PromtailConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.promtail);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
