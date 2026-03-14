// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getGrafanaImage, INTERNAL_PORTS} from '@/config';
import type {GrafanaConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

// Grafana configuration with anonymous access enabled
const GRAFANA_INI = `
[auth]
disable_login_form = false

[auth.anonymous]
enabled = true
org_role = Editor
`;

// Datasources provisioning for Prometheus and Loki
const DATASOURCES_YAML = `
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
`;

export interface GrafanaConfig {
    image?: string;
}

export async function createGrafanaContainer(
    network: StartedNetwork,
    config: GrafanaConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getGrafanaImage();

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('grafana')
        .withCopyContentToContainer([
            {content: GRAFANA_INI, target: '/etc/grafana/grafana.ini'},
            {content: DATASOURCES_YAML, target: '/etc/grafana/provisioning/datasources/datasources.yaml'},
        ])
        .withExposedPorts(INTERNAL_PORTS.grafana)
        .withLogConsumer(createFileLogConsumer('grafana'))
        .withWaitStrategy(Wait.forHttp('/api/health', INTERNAL_PORTS.grafana).withStartupTimeout(60_000))
        .start();

    return container;
}

export function getGrafanaConnectionInfo(container: StartedTestContainer, image: string): GrafanaConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.grafana);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
