#!/usr/bin/env node
// Loopback-only TCP forwarder: 127.0.0.1:${PILOT_PORT:-8065} -> <mattermost container IP>:8065.
// A raw byte pipe, so HTTP and WebSocket upgrades both pass through. Logs no payloads.
import {execFileSync} from 'node:child_process';
import net from 'node:net';

const CONTAINER = 'explorer-pilot-mattermost';
const NETWORK = 'explorer-pilot_pilot_internal';
const TARGET_PORT = 8065;
const LISTEN_HOST = process.env.PILOT_HOST || '127.0.0.1';
const LISTEN_PORT = Number(process.env.PILOT_PORT || 8065);

const log = (msg) => process.stdout.write(`[forwarder] ${msg}\n`);

if (LISTEN_HOST !== '127.0.0.1') {
    log(`refusing to listen on non-loopback address ${LISTEN_HOST}`);
    process.exit(1);
}
if (!Number.isInteger(LISTEN_PORT) || LISTEN_PORT < 1 || LISTEN_PORT > 65535) {
    log('invalid PILOT_PORT');
    process.exit(1);
}

function resolveTarget() {
    const template = `{{ (index .NetworkSettings.Networks "${NETWORK}").IPAddress }}`;
    const ip = execFileSync('docker', ['inspect', '--format', template, CONTAINER], {encoding: 'utf8'}).trim();
    if (net.isIPv4(ip) === false) {
        throw new Error(`no IPv4 address for ${CONTAINER} on ${NETWORK}`);
    }
    return ip;
}

let targetIp = null;
function currentTarget() {
    if (!targetIp) {
        targetIp = resolveTarget();
        log(`target ${targetIp}:${TARGET_PORT}`);
    }
    return targetIp;
}

const sockets = new Set();
const track = (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
};

const server = net.createServer((client) => {
    track(client);
    let ip;
    try {
        ip = currentTarget();
    } catch (err) {
        log(`resolve failed: ${err.message}`);
        client.destroy();
        return;
    }
    const upstream = net.connect({host: ip, port: TARGET_PORT});
    track(upstream);
    upstream.on('error', (err) => {
        if (['ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT'].includes(err.code)) {
            targetIp = null;
        }
        log(`upstream error ${err.code || 'unknown'}`);
        client.destroy();
    });
    client.on('error', () => upstream.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
});

server.on('error', (err) => {
    log(`listen error ${err.code || 'unknown'}`);
    process.exit(1);
});

server.listen({host: LISTEN_HOST, port: LISTEN_PORT, exclusive: true}, () => {
    const addr = server.address();
    if (addr.address !== '127.0.0.1') {
        log(`bound to unexpected address ${addr.address}; exiting`);
        process.exit(1);
    }
    log(`listening on ${addr.address}:${addr.port}`);
    try {
        currentTarget();
    } catch (err) {
        log(`resolve failed: ${err.message}`);
    }
});

function shutdown(signal) {
    log(`${signal} received, closing`);
    server.close(() => process.exit(0));
    for (const s of sockets) {
        s.destroy();
    }
    setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
