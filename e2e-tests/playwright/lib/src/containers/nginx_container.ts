// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';

import {certificateFor, hasCertificateFor} from '@expo/devcert';
import {GenericContainer, Wait} from 'testcontainers';
import type {StartedNetwork, StartedTestContainer} from 'testcontainers';

import {
    MATTERMOST_ALIAS,
    MATTERMOST_PORT,
    NGINX_ALIAS,
    NGINX_FIXED_HOST_PORT,
    NGINX_PORT,
    NGINX_SSL_FIXED_HOST_PORT,
    NGINX_SSL_PORT,
    SUBPATH_DEFAULT,
    TESTCONTAINERS_LABELS,
} from './constants';
import {NGINX_IMAGE} from './default_images';
import {logTestcontainers, warnTestcontainers} from './log';
import {startWithRetry} from './retry';

import {testConfig} from '@/test_config';

const execFileAsync = promisify(execFile);

const CERT_PATH = '/etc/nginx/certs/cert.pem';
const KEY_PATH = '/etc/nginx/certs/key.pem';

async function generateSelfSignedCert(): Promise<{cert: string; key: string}> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nginx-cert-'));
    const keyPath = path.join(dir, 'key.pem');
    const certPath = path.join(dir, 'cert.pem');

    try {
        await execFileAsync('openssl', [
            'req',
            '-x509',
            '-newkey',
            'rsa:2048',
            '-nodes',
            '-keyout',
            keyPath,
            '-out',
            certPath,
            '-days',
            '1',
            '-subj',
            '/CN=localhost',
        ]);
        const [cert, key] = await Promise.all([fs.readFile(certPath, 'utf-8'), fs.readFile(keyPath, 'utf-8')]);
        return {cert, key};
    } finally {
        await fs.rm(dir, {recursive: true, force: true});
    }
}

// devcert issues a cert signed by a locally-trusted CA (cached after the first call). Skipped in
// CI, where an ephemeral runner shouldn't accept a new trusted CA and no one browses to the URL.
async function generateTrustedCert(): Promise<{cert: string; key: string} | undefined> {
    if (testConfig.isCI) {
        return undefined;
    }

    // First call triggers CA install (sudo password prompt on macOS/Linux) — explain it up front.
    if (!hasCertificateFor('localhost')) {
        logTestcontainers(
            'no locally-trusted certificate found for "localhost" yet — devcert will generate a root CA and ' +
                'add it to your system trust store so browsers stop warning about the nginx https URL. This ' +
                'may prompt for your machine login password (a plain "sudo security add-trusted-cert" call, ' +
                'nothing sent over the network). Declining is safe: it just falls back to a self-signed ' +
                'certificate, same as before.',
        );
    }

    try {
        const {cert, key} = await certificateFor('localhost');
        return {cert: cert.toString(), key: key.toString()};
    } catch (error) {
        warnTestcontainers(
            `devcert could not issue a locally-trusted certificate (${String(error)}) — falling back to a ` +
                'self-signed certificate. Browsers will warn when opening the nginx https URL manually; this ' +
                'does not affect Playwright itself.',
        );
        return undefined;
    }
}

async function generateCert(): Promise<{cert: string; key: string}> {
    return (await generateTrustedCert()) ?? generateSelfSignedCert();
}

function locationBlocks(backend: string): string {
    return `
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

    # Avoids a HEAD-request redirect loop under the subpath.
    location ~* ^${SUBPATH_DEFAULT} {
        set $upstream ${backend};
        if ($request_method = HEAD) {
            return 200;
        }
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
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
    }`;
}

function nginxConfig(ssl: boolean): string {
    const backend = `http://${MATTERMOST_ALIAS}:${MATTERMOST_PORT}`;
    const server = ssl
        ? `listen ${NGINX_SSL_PORT} ssl;
    ssl_certificate ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};`
        : `listen ${NGINX_PORT} default_server;`;

    return `
# Resolves the backend at request time (not config-load time) so this container can start before
# Mattermost is up.
resolver 127.0.0.11 valid=10s;

server {
    ${server}
${locationBlocks(backend)}
}
`;
}

export async function startNginxContainer(network: StartedNetwork): Promise<StartedTestContainer> {
    return startWithRetry('nginx', async () => {
        const ssl = testConfig.sslServer;

        let builder = new GenericContainer(NGINX_IMAGE)
            .withExposedPorts(
                ssl
                    ? {container: NGINX_SSL_PORT, host: NGINX_SSL_FIXED_HOST_PORT}
                    : {container: NGINX_PORT, host: NGINX_FIXED_HOST_PORT},
            )
            .withNetwork(network)
            .withNetworkAliases(NGINX_ALIAS)
            .withLabels(TESTCONTAINERS_LABELS)
            .withCopyContentToContainer([{content: nginxConfig(ssl), target: '/etc/nginx/conf.d/default.conf'}])
            .withStartupTimeout(60_000)
            .withWaitStrategy(Wait.forListeningPorts());

        if (ssl) {
            const {cert, key} = await generateCert();
            builder = builder.withCopyContentToContainer([
                {content: cert, target: CERT_PATH},
                {content: key, target: KEY_PATH},
            ]);
        }

        if (testConfig.testcontainersReuse) {
            builder = builder.withReuse();
        }

        return builder.start();
    });
}
