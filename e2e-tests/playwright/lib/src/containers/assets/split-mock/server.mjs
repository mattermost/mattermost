// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A stand-in for the Split.io services the Mattermost server's feature flag synchronizer talks to
// (sdk.split.io, events.split.io, auth.split.io, streaming.split.io, telemetry.split.io), so e2e
// specs can change feature flags on a running server instead of restarting it.
//
// Two listeners:
//  - the Split API (HTTPS when TLS_CERT/TLS_KEY are set, else HTTP) on SPLIT_PORT, reached by the
//    server through network aliases for the split.io hostnames;
//  - a plain-HTTP control API on CONTROL_PORT for the test harness (not part of Split):
//      GET  /health            liveness
//      GET  /ca.pem            CA certificate the server must trust (when TLS is on)
//      GET  /flags             current flags and their baselines
//      PUT  /flags             change flags (see below)
//      PUT  /segments          {Name: [key, ...]} - define segments
//      POST /reset             restore every flag the harness changed to its baseline value, drop segments
//
// PUT /flags takes {set, define, baseline}:
//   set       {Flag: value}: serve the flag with the same value to every key.
//   define    {Flag: {value, rules: [...]}}: serve `value` unless a rule matches. Rules that only name keys apply
//             first, then the rest in order, and the first match wins. A rule is
//             {value, keys?, segment?, attributes?, percentage?}; its conditions are AND-ed: `keys` whitelists
//             evaluation keys, `segment` requires membership of a segment, `attributes` requires every attribute
//             to equal the given string, `percentage` gives that share of keys (by hash) the rule's value and
//             the rest the flag's value.
//   baseline  {Flag: value}: the value the flag had before the harness first changed it, remembered so reset
//             can restore it.
//
// Flags the harness never touched are not served, so the server reports "control" for them and keeps
// their defaults. A flag the harness touched is never removed (a removed flag would be "control" too,
// which the server treats as "keep the last value"); reset sets it back to its baseline explicitly.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const SPLIT_PORT = Number(process.env.SPLIT_PORT || 443);
const CONTROL_PORT = Number(process.env.CONTROL_PORT || 4000);
const TLS_CERT = process.env.TLS_CERT;
const TLS_KEY = process.env.TLS_KEY;
const CA_FILE = process.env.CA_FILE;
const TRAFFIC_TYPE = 'user';

const flags = new Map(); // name -> {value, rules, changeNumber}
const segments = new Map(); // name -> {keys: Set, changeNumber}
const baselines = new Map(); // name -> value, captured the first time a flag is changed
let changeNumber = 1;
const streams = new Set();

function treatmentFor(value) {
    const text = String(value);
    if (text === 'true') {
        return 'on';
    }
    if (text === 'false') {
        return 'off';
    }
    return text;
}

const ALL_KEYS = {keySelector: null, matcherType: 'ALL_KEYS', negate: false};

function ruleMatchers(rule) {
    const matchers = [];
    if (rule.segment) {
        matchers.push({
            keySelector: null,
            matcherType: 'IN_SEGMENT',
            negate: false,
            userDefinedSegmentMatcherData: {segmentName: rule.segment},
        });
    }
    for (const [attribute, expected] of Object.entries(rule.attributes || {})) {
        matchers.push({
            keySelector: {trafficType: TRAFFIC_TYPE, attribute},
            matcherType: 'WHITELIST',
            negate: false,
            whitelistMatcherData: {whitelist: [String(expected)]},
        });
    }
    return matchers.length > 0 ? matchers : [ALL_KEYS];
}

function ruleConditions(rule, defaultTreatment) {
    const treatment = treatmentFor(rule.value);
    const conditions = [];
    if (rule.keys && rule.keys.length > 0 && !rule.segment && !rule.attributes && rule.percentage === undefined) {
        // A plain key list is what Split calls a whitelist: it is matched before any rollout rule.
        conditions.push({
            conditionType: 'WHITELIST',
            matcherGroup: {
                combiner: 'AND',
                matchers: [
                    {
                        keySelector: null,
                        matcherType: 'WHITELIST',
                        negate: false,
                        whitelistMatcherData: {whitelist: rule.keys},
                    },
                ],
            },
            partitions: [{treatment, size: 100}],
            label: 'whitelisted',
        });
        return conditions;
    }

    const matchers = ruleMatchers(rule);
    if (rule.keys && rule.keys.length > 0) {
        matchers.push({
            keySelector: null,
            matcherType: 'WHITELIST',
            negate: false,
            whitelistMatcherData: {whitelist: rule.keys},
        });
    }
    const percentage = rule.percentage === undefined ? 100 : rule.percentage;
    const partitions =
        percentage >= 100
            ? [{treatment, size: 100}]
            : [
                  {treatment, size: percentage},
                  {treatment: defaultTreatment, size: 100 - percentage},
              ];
    conditions.push({conditionType: 'ROLLOUT', matcherGroup: {combiner: 'AND', matchers}, partitions, label: 'rule'});
    return conditions;
}

function splitDTO(name, entry) {
    const treatment = treatmentFor(entry.value);
    const rules = entry.rules || [];
    const whitelists = rules.flatMap((rule) =>
        ruleConditions(rule, treatment).filter((condition) => condition.conditionType === 'WHITELIST'),
    );
    const rollouts = rules.flatMap((rule) =>
        ruleConditions(rule, treatment).filter((condition) => condition.conditionType === 'ROLLOUT'),
    );
    return {
        trafficTypeName: TRAFFIC_TYPE,
        name,
        trafficAllocation: 100,
        trafficAllocationSeed: 1,
        seed: 1,
        status: 'ACTIVE',
        killed: false,
        defaultTreatment: treatment,
        changeNumber: entry.changeNumber,
        algo: 2,
        conditions: [
            ...whitelists,
            ...rollouts,
            {
                conditionType: 'ROLLOUT',
                matcherGroup: {combiner: 'AND', matchers: [ALL_KEYS]},
                partitions: [{treatment, size: 100}],
                label: 'default rule',
            },
        ],
        configurations: {},
        sets: [],
    };
}

function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)});
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}

function b64url(value) {
    return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

// The SDK only reads the payload (channel capabilities and expiry); it does not verify the signature.
function authToken() {
    const now = Math.floor(Date.now() / 1000);
    const capability = {
        e2e_split_mocks: ['subscribe'],
        e2e_split_mock_segments: ['subscribe'],
        control_pri: ['subscribe', 'channel-metadata:publishers'],
        control_sec: ['subscribe', 'channel-metadata:publishers'],
    };
    const header = b64url({alg: 'HS256', typ: 'JWT'});
    const payload = b64url({'x-ably-capability': JSON.stringify(capability), exp: now + 3600, iat: now});
    return `${header}.${payload}.${b64url(crypto.randomBytes(16))}`;
}

function sseSend(res, event, data, id) {
    res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function occupancyMessage(channel) {
    return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        encoding: 'json',
        channel: `[?occupancy=metrics.publishers]${channel}`,
        data: JSON.stringify({metrics: {publishers: 1}}),
        name: '[meta]occupancy',
    };
}

function splitUpdateMessage(number) {
    return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        encoding: 'json',
        channel: 'e2e_split_mocks',
        data: JSON.stringify({type: 'SPLIT_UPDATE', changeNumber: number}),
        name: 'e2e-mock',
    };
}

function segmentUpdateMessage(name, number) {
    return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        encoding: 'json',
        channel: 'e2e_split_mock_segments',
        data: JSON.stringify({type: 'SEGMENT_UPDATE', changeNumber: number, segmentName: name}),
        name: 'e2e-mock',
    };
}

function notifyStreams(changedSegments = []) {
    for (const res of streams) {
        sseSend(res, 'message', splitUpdateMessage(changeNumber));
        for (const name of changedSegments) {
            sseSend(res, 'message', segmentUpdateMessage(name, segments.get(name).changeNumber));
        }
    }
}

function handleStream(req, res) {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
    // The SDK treats the first event as "streaming is up"; occupancy for both control channels tells
    // its status tracker that publishers are present, so it stays on streaming rather than polling.
    sseSend(res, 'message', occupancyMessage('control_pri'));
    sseSend(res, 'message', occupancyMessage('control_sec'));
    streams.add(res);
    const keepAlive = setInterval(() => res.write(':keepalive\n\n'), 20000);
    req.on('close', () => {
        clearInterval(keepAlive);
        streams.delete(res);
    });
}

function handleSplitChanges(url, res) {
    const since = Number(url.searchParams.get('since') || -1);
    const splits = [];
    for (const [name, entry] of flags) {
        if (entry.changeNumber > since) {
            splits.push(splitDTO(name, entry));
        }
    }
    // Spec 1.3 wraps flags and rule-based segments; older specs return a flat list. The SDK asks for a
    // spec through the `s` query parameter, so answer in the matching shape.
    if ((url.searchParams.get('s') || '').startsWith('1.3')) {
        return json(res, 200, {
            ff: {t: changeNumber, s: since, d: splits},
            rbs: {t: -1, s: Number(url.searchParams.get('rbSince') || -1), d: []},
        });
    }
    return json(res, 200, {splits, since, till: changeNumber});
}

function handleSplitApi(req, res) {
    const url = new URL(req.url, 'http://split.local');
    const path = url.pathname;
    log(`${req.method} ${path}${url.search}`);

    if (path.endsWith('/splitChanges') && req.method === 'GET') {
        return handleSplitChanges(url, res);
    }
    if (path.includes('/segmentChanges/') && req.method === 'GET') {
        const name = decodeURIComponent(path.split('/').pop());
        const since = Number(url.searchParams.get('since') || -1);
        const segment = segments.get(name);
        if (!segment) {
            return json(res, 200, {name, added: [], removed: [], since, till: since});
        }
        // Keys added or removed after `since`, so a segment edit reaches the SDK as an incremental change.
        const added = [];
        const removed = [];
        for (const [key, change] of segment.keys) {
            if (change.changeNumber > since) {
                (change.present ? added : removed).push(key);
            }
        }
        return json(res, 200, {name, added, removed, since, till: segment.changeNumber});
    }
    if (path.includes('/memberships/') && req.method === 'GET') {
        return json(res, 200, {ms: {k: []}, ls: {k: []}});
    }
    if (path.endsWith('/v2/auth') && req.method === 'GET') {
        return json(res, 200, {pushEnabled: true, token: authToken()});
    }
    if (path.endsWith('/sse') && req.method === 'GET') {
        return handleStream(req, res);
    }
    if (req.method === 'POST') {
        // Impressions, events and telemetry the SDK reports. Nothing consumes them.
        req.resume();
        res.writeHead(200);
        return res.end();
    }
    res.writeHead(404);
    return res.end();
}

function sameDefinition(entry, value, rules) {
    return entry && entry.value === String(value) && JSON.stringify(entry.rules || []) === JSON.stringify(rules || []);
}

function setFlag(name, value, rules = []) {
    changeNumber += 1;
    flags.set(name, {value: String(value), rules, changeNumber});
}

function setSegment(name, keys) {
    changeNumber += 1;
    const wanted = new Set(keys.map(String));
    const segment = segments.get(name) || {keys: new Map(), changeNumber};
    for (const [key, change] of segment.keys) {
        if (change.present && !wanted.has(key)) {
            segment.keys.set(key, {present: false, changeNumber});
        }
    }
    for (const key of wanted) {
        const change = segment.keys.get(key);
        if (!change || !change.present) {
            segment.keys.set(key, {present: true, changeNumber});
        }
    }
    segment.changeNumber = changeNumber;
    segments.set(name, segment);
}

async function handleControl(req, res) {
    const url = new URL(req.url, 'http://control.local');

    if (url.pathname === '/health') {
        return json(res, 200, {ok: true, streams: streams.size});
    }
    if (url.pathname === '/ca.pem' && CA_FILE) {
        res.writeHead(200, {'Content-Type': 'application/x-pem-file'});
        return res.end(fs.readFileSync(CA_FILE));
    }
    if (url.pathname === '/flags' && req.method === 'GET') {
        return json(res, 200, {
            flags: Object.fromEntries([...flags].map(([name, entry]) => [name, entry.value])),
            rules: Object.fromEntries([...flags].map(([name, entry]) => [name, entry.rules || []])),
            segments: Object.fromEntries(
                [...segments].map(([name, segment]) => [
                    name,
                    [...segment.keys].filter(([, c]) => c.present).map(([k]) => k),
                ]),
            ),
            baselines: Object.fromEntries(baselines),
            changeNumber,
        });
    }
    if (url.pathname === '/flags' && req.method === 'PUT') {
        let body;
        try {
            body = JSON.parse((await readBody(req)) || '{}');
        } catch {
            return json(res, 400, {error: 'invalid JSON'});
        }
        const baseline = body.baseline || {};
        const definitions = {};
        for (const [name, value] of Object.entries(body.set || {})) {
            definitions[name] = {value, rules: []};
        }
        for (const [name, definition] of Object.entries(body.define || {})) {
            definitions[name] = {value: definition.value, rules: definition.rules || []};
        }
        for (const [name, definition] of Object.entries(definitions)) {
            // Remember what the flag was before the harness first touched it, so reset can restore it.
            if (!baselines.has(name) && name in baseline) {
                baselines.set(name, String(baseline[name]));
            }
            if (!sameDefinition(flags.get(name), definition.value, definition.rules)) {
                setFlag(name, definition.value, definition.rules);
            }
        }
        notifyStreams();
        return json(res, 200, {changeNumber});
    }
    if (url.pathname === '/segments' && req.method === 'PUT') {
        let body;
        try {
            body = JSON.parse((await readBody(req)) || '{}');
        } catch {
            return json(res, 400, {error: 'invalid JSON'});
        }
        for (const [name, keys] of Object.entries(body)) {
            setSegment(name, keys);
        }
        notifyStreams(Object.keys(body));
        return json(res, 200, {changeNumber});
    }
    if (url.pathname === '/reset' && req.method === 'POST') {
        const restored = {};
        for (const [name, value] of baselines) {
            if (!sameDefinition(flags.get(name), value, [])) {
                setFlag(name, value);
                restored[name] = value;
            }
        }
        // A segment can't be deleted from the SDK's view, so empty it.
        for (const name of segments.keys()) {
            setSegment(name, []);
        }
        notifyStreams([...segments.keys()]);
        return json(res, 200, {restored, changeNumber});
    }

    res.writeHead(404);
    return res.end();
}

function log(message) {
    if (process.env.SPLIT_MOCK_VERBOSE) {
        // eslint-disable-next-line no-console
        console.log(`[split-mock] ${message}`);
    }
}

const splitServer =
    TLS_CERT && TLS_KEY
        ? https.createServer({cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY)}, handleSplitApi)
        : http.createServer(handleSplitApi);
splitServer.listen(SPLIT_PORT, '0.0.0.0', () =>
    console.log(`split api on :${SPLIT_PORT} (${TLS_CERT ? 'tls' : 'plain'})`),
);

http.createServer((req, res) => {
    handleControl(req, res).catch((error) => {
        console.error(error);
        res.writeHead(500);
        res.end();
    });
}).listen(CONTROL_PORT, '0.0.0.0', () => console.log(`control api on :${CONTROL_PORT}`));
