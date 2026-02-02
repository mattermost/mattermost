// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { GenericContainer, Wait } from 'testcontainers';
import { getPromtailImage, INTERNAL_PORTS } from '../config/defaults';
import { createFileLogConsumer } from '../utils/log';
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
export async function createPromtailContainer(network, config = {}) {
    const image = config.image ?? getPromtailImage();
    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('promtail')
        .withCopyContentToContainer([{ content: PROMTAIL_CONFIG, target: '/etc/promtail/config.yaml' }])
        .withCommand(['-config.file=/etc/promtail/config.yaml'])
        .withExposedPorts(INTERNAL_PORTS.promtail)
        .withLogConsumer(createFileLogConsumer('promtail'))
        // Use port check instead of /ready endpoint (which requires Loki connectivity)
        .withWaitStrategy(Wait.forListeningPorts())
        .withStartupTimeout(60_000)
        .start();
    return container;
}
export function getPromtailConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.promtail);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
