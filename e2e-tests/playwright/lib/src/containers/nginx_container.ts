// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {
    MATTERMOST_ALIAS,
    MATTERMOST_PORT,
    NGINX_ALIAS,
    NGINX_FIXED_HOST_PORT,
    NGINX_PORT,
    TESTCONTAINERS_LABELS,
} from './constants';
import {NGINX_IMAGE} from './default_images';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

// Plain HTTP reverse proxy fronting the Mattermost container — lets specs exercise a server
// reached through an intermediary (e.g. validating trusted-proxy/forwarded-header behavior)
// without needing a real external proxy.
function nginxConfig(): string {
    const backend = `http://${MATTERMOST_ALIAS}:${MATTERMOST_PORT}`;

    return `
# Resolves the backend at request time (not config-load time) so this container can start before
# Mattermost is up.
resolver 127.0.0.11 valid=10s;

server {
    listen ${NGINX_PORT} default_server;

    location ~ /api/v[0-9]+/(users/)?websocket$ {
        set $upstream ${backend};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        client_max_body_size 100M;
        proxy_pass $upstream;
    }

    location / {
        set $upstream ${backend};
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        client_max_body_size 100M;
        proxy_pass $upstream;
    }
}
`;
}

export async function startNginxContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('nginx', async () => {
        let builder = new GenericContainer(NGINX_IMAGE)
            .withExposedPorts({container: NGINX_PORT, host: NGINX_FIXED_HOST_PORT})
            .withNetwork(network)
            .withNetworkAliases(NGINX_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withCopyContentToContainer([{content: nginxConfig(), target: '/etc/nginx/conf.d/default.conf'}])
            .withStartupTimeout(60_000)
            .withWaitStrategy(Wait.forListeningPorts());

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
