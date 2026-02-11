// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getNginxImage, INTERNAL_PORTS} from '@/config';
import type {NginxConnectionInfo} from '@/config';
import {createFileLogConsumer} from '@/utils';

/**
 * Generate nginx configuration for load balancing Mattermost nodes.
 * Based on server/build/docker/nginx/default.conf
 */
function generateNginxConfig(nodeAliases: string[]): string {
    const upstreamServers = nodeAliases
        .map((alias) => `  server ${alias}:${INTERNAL_PORTS.mattermost} fail_timeout=10s max_fails=10;`)
        .join('\n');

    return `upstream app_cluster {
${upstreamServers}
}

server {
  listen ${INTERNAL_PORTS.nginx};

  location ~ /api/v[0-9]+/(users/)?websocket$ {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    client_max_body_size 50M;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_buffers 256 16k;
    proxy_buffer_size 16k;
    proxy_read_timeout 600s;
    proxy_pass http://app_cluster;
  }

  location / {
    client_max_body_size 100M;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_pass http://app_cluster;
  }
}
`;
}

/**
 * Generate location blocks for a subpath server.
 * Uses a variable for proxy_pass so that DNS resolution is deferred to request time
 * (via the resolver directive). This allows nginx to start before backends exist.
 * Mattermost handles subpath natively via SiteURL configuration.
 */
function generateSubpathLocationBlocks(subpath: string, varName: string, backendUrl: string): string {
    // When proxy_pass uses a variable, nginx does NOT auto-append the request URI.
    // We must explicitly append $request_uri to forward the full original path.
    return `
  # WebSocket endpoint for ${subpath}
  location ~ ^${subpath}/api/v[0-9]+/(users/)?websocket$ {
    set $${varName}_ws ${backendUrl};
    client_body_timeout 60;
    client_max_body_size 50M;
    lingering_timeout 5;
    proxy_buffer_size 16k;
    proxy_buffers 256 16k;
    proxy_connect_timeout 90;
    proxy_pass $${varName}_ws$request_uri;
    proxy_read_timeout 90s;
    proxy_send_timeout 300;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_set_header X-Real-IP $remote_addr;
    send_timeout 300;
  }

  # Main location for ${subpath} - passes full path to Mattermost
  location ${subpath}/ {
    set $${varName} ${backendUrl};
    client_max_body_size 50M;
    proxy_buffer_size 16k;
    proxy_buffers 256 16k;
    proxy_http_version 1.1;
    proxy_pass $${varName}$request_uri;
    proxy_read_timeout 600s;
    proxy_set_header Connection "";
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Redirect ${subpath} to ${subpath}/ for consistent behavior
  location = ${subpath} {
    return 301 ${subpath}/;
  }`;
}

/**
 * Generate the landing page HTML for subpath mode.
 */
function generateSubpathLandingPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mattermost Subpath Test Environment</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #1e325c;
      color: #fff;
    }
    h1 { color: #fff; margin-bottom: 10px; }
    .subtitle { color: #aab8d1; margin-bottom: 40px; }
    .servers { display: flex; gap: 20px; flex-wrap: wrap; }
    .server-card {
      flex: 1;
      min-width: 280px;
      background: #2d4073;
      border-radius: 8px;
      padding: 24px;
      text-decoration: none;
      color: #fff;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .server-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .server-card h2 { margin: 0 0 8px 0; color: #fff; }
    .server-card .path { color: #5d9cec; font-family: monospace; font-size: 14px; }
    .server-card .desc { color: #aab8d1; margin-top: 12px; font-size: 14px; }
    .info {
      margin-top: 40px;
      padding: 20px;
      background: #2d4073;
      border-radius: 8px;
      font-size: 14px;
      color: #aab8d1;
    }
    .info code { background: #1e325c; padding: 2px 6px; border-radius: 4px; color: #5d9cec; }
  </style>
</head>
<body>
  <h1>Mattermost Subpath Test Environment</h1>
  <p class="subtitle">Two Mattermost servers running behind nginx with subpath routing</p>

  <div class="servers">
    <a href="/mattermost1" class="server-card">
      <h2>Server 1</h2>
      <div class="path">/mattermost1</div>
      <div class="desc">First Mattermost instance with its own database</div>
    </a>
    <a href="/mattermost2" class="server-card">
      <h2>Server 2</h2>
      <div class="path">/mattermost2</div>
      <div class="desc">Second Mattermost instance with its own database</div>
    </a>
  </div>

  <div class="info">
    <strong>Test Environment Info:</strong><br><br>
    This environment runs two independent Mattermost servers behind an nginx reverse proxy.
    Each server has its own database and can be accessed via its subpath.<br><br>
    Use <code>mattermost-testcontainers stop</code> to stop all containers.
  </div>
</body>
</html>`;
}

/**
 * Generate nginx configuration for subpath mode with two Mattermost servers.
 * Uses Docker's embedded DNS resolver (127.0.0.11) so nginx can start before
 * Mattermost backends exist. DNS is resolved at request time via variables.
 *
 * In subpath mode, nginx MUST start before backends (to get the port for SiteURL).
 * This means we cannot use upstream blocks (they resolve DNS at startup and fail
 * if backends don't exist). Instead, all backends use variable-based proxy_pass
 * which defers DNS resolution to request time via the resolver directive.
 *
 * For HA, server1 routes to the leader node. The HA cluster still functions
 * (all nodes share the database and gossip), but nginx routes to the leader.
 *
 * Based on e2e-tests/cypress/README-Subpath.md
 */
function generateSubpathNginxConfig(server1Aliases: string[], server2Alias: string): string {
    // server1: always variable-based proxy (routes to first alias / leader)
    // We use the first alias (leader in HA) since upstream blocks can't work
    // when nginx starts before backends.
    const backend1Url = `http://${server1Aliases[0]}:${INTERNAL_PORTS.mattermost}`;
    const locations1 = generateSubpathLocationBlocks('/mattermost1', 'backend1', backend1Url);

    // server2: always variable-based single proxy
    const backend2Url = `http://${server2Alias}:${INTERNAL_PORTS.mattermost}`;
    const locations2 = generateSubpathLocationBlocks('/mattermost2', 'backend2', backend2Url);

    // Escape the HTML for nginx config (single quotes need escaping)
    const landingPage = generateSubpathLandingPage().replace(/'/g, "\\'");

    return `# Use Docker embedded DNS so hostnames resolve at request time (not startup)
resolver 127.0.0.11 valid=5s;

server {
  listen ${INTERNAL_PORTS.nginx} default_server;

  # Send relative redirects (path only) instead of absolute URLs.
  # Without this, nginx constructs redirects using its internal listen port (8065),
  # not the externally mapped port, breaking the 301 /mattermost1 -> /mattermost1/ redirect.
  absolute_redirect off;

  location = / {
    default_type text/html;
    return 200 '${landingPage}';
  }
${locations1}
${locations2}
}
`;
}

export interface NginxConfig {
    image?: string;
    /** Network aliases of Mattermost nodes to load balance */
    nodeAliases: string[];
}

export interface SubpathNginxConfig {
    image?: string;
    /** Network aliases of Mattermost server 1 (array for HA, single element for single node) */
    server1Aliases: string[];
    /** Network alias of Mattermost server 2 (always single node) */
    server2Alias: string;
}

export async function createNginxContainer(
    network: StartedNetwork,
    config: NginxConfig,
): Promise<StartedTestContainer> {
    const image = config.image ?? getNginxImage();
    const nginxConfig = generateNginxConfig(config.nodeAliases);

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('nginx')
        .withCopyContentToContainer([{content: nginxConfig, target: '/etc/nginx/conf.d/default.conf'}])
        .withExposedPorts(INTERNAL_PORTS.nginx)
        .withLogConsumer(createFileLogConsumer('nginx'))
        .withWaitStrategy(Wait.forListeningPorts())
        .start();

    return container;
}

export async function createSubpathNginxContainer(
    network: StartedNetwork,
    config: SubpathNginxConfig,
): Promise<StartedTestContainer> {
    const image = config.image ?? getNginxImage();
    const nginxConfig = generateSubpathNginxConfig(config.server1Aliases, config.server2Alias);

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('nginx')
        .withCopyContentToContainer([{content: nginxConfig, target: '/etc/nginx/conf.d/default.conf'}])
        .withExposedPorts(INTERNAL_PORTS.nginx)
        .withLogConsumer(createFileLogConsumer('nginx'))
        .withWaitStrategy(Wait.forListeningPorts())
        .start();

    return container;
}

export function getNginxConnectionInfo(container: StartedTestContainer, image: string): NginxConnectionInfo {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.nginx);

    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}
