#!/usr/bin/env node
// Tiny HTTP/WebSocket probes for gate.sh. Never prints response bodies; exit 0 = pass.
//   probe.mjs ready <baseUrl>      GET /api/v4/system/ping -> status OK
//   probe.mjs db <baseUrl>         GET /api/v4/system/ping?get_server_status=true -> database_status OK
//   probe.mjs ws <host> <port>     WebSocket upgrade on /api/v4/websocket -> HTTP 101
//   probe.mjs license <baseUrl>    ensure first sysadmin, then IsLicensed === 'true' via /api/v4/license/client?format=old
import net from 'node:net';

const ADMIN = {
    username: process.env.PW_ADMIN_USERNAME || 'sysadmin',
    password: process.env.PW_ADMIN_PASSWORD || 'Sys@dmin-sample1',
    email: process.env.PW_ADMIN_EMAIL || 'sysadmin@sample.mattermost.com',
};

async function getJson(url, init = {}) {
    const res = await fetch(url, {...init, signal: AbortSignal.timeout(10000)});
    let body = null;
    try {
        body = await res.json();
    } catch {
        body = null;
    }
    return {res, body};
}

async function ready(base) {
    const {res, body} = await getJson(`${base}/api/v4/system/ping`);
    return res.ok && body?.status === 'OK';
}

async function db(base) {
    const {res, body} = await getJson(`${base}/api/v4/system/ping?get_server_status=true`);
    return res.ok && body?.database_status === 'OK';
}

function ws(host, port) {
    return new Promise((resolve) => {
        const sock = net.connect({host, port: Number(port)});
        const done = (ok) => {
            sock.destroy();
            resolve(ok);
        };
        sock.setTimeout(5000, () => done(false));
        sock.on('error', () => done(false));
        sock.on('connect', () => {
            sock.write(
                'GET /api/v4/websocket HTTP/1.1\r\n' +
                    `Host: 127.0.0.1:${port}\r\n` +
                    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
                    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n' +
                    `Origin: http://127.0.0.1:${port}\r\n\r\n`,
            );
        });
        sock.once('data', (chunk) => done(/^HTTP\/1\.1 101 /.test(chunk.toString('latin1'))));
    });
}

async function login(base) {
    const {res} = await getJson(`${base}/api/v4/users/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({login_id: ADMIN.username, password: ADMIN.password}),
    });
    return res.ok ? res.headers.get('token') : null;
}

// Mirrors lib/src/global_setup.ts baseGlobalSetup: create the first user (who becomes system admin) only if login fails.
async function ensureAdminToken(base) {
    let token = await login(base);
    if (!token) {
        await getJson(`${base}/api/v4/users`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: ADMIN.email, username: ADMIN.username, password: ADMIN.password}),
        });
        token = await login(base);
    }
    return token;
}

async function license(base) {
    const token = await ensureAdminToken(base);
    if (!token) {
        return false;
    }
    const {res, body} = await getJson(`${base}/api/v4/license/client?format=old`, {
        headers: {Authorization: `Bearer ${token}`},
    });
    return res.ok && body?.IsLicensed === 'true';
}

const [cmd, ...args] = process.argv.slice(2);
const probes = {ready, db, ws, license};
let ok = false;
try {
    ok = probes[cmd] ? await probes[cmd](...args) : false;
} catch {
    ok = false;
}
process.exit(ok ? 0 : 1);
