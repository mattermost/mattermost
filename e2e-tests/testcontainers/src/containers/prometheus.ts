// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getPrometheusImage, INTERNAL_PORTS} from '@/config';
import type {PrometheusConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

// Prometheus configuration for scraping Mattermost metrics
const PROMETHEUS_CONFIG = `
global:
  scrape_interval: 5s
  evaluation_interval: 60s

scrape_configs:
  - job_name: 'mattermost'
    static_configs:
      - targets: ['mattermost:8067']
`;

export interface PrometheusConfig {
    image?: string;
}

export async function createPrometheusContainer(
    network: StartedNetwork,
    config: PrometheusConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getPrometheusImage();

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('prometheus')
        .withCopyContentToContainer([{content: PROMETHEUS_CONFIG, target: '/etc/prometheus/prometheus.yml'}])
        .withExposedPorts(INTERNAL_PORTS.prometheus)
        .withLogConsumer(createFileLogConsumer('prometheus'))
        .withWaitStrategy(Wait.forHttp('/-/ready', INTERNAL_PORTS.prometheus).withStartupTimeout(60_000))
        .start();

    return container;
}

export function getPrometheusConnectionInfo(container: StartedTestContainer, image: string): PrometheusConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.prometheus);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
