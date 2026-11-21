// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Containment for the UNMODIFIED repo-native spec run through explorer-proto/playwright.config.ts in
// replay-journey mode. The spec uses plain repo fixtures (pw.testBrowser.login -> browser.newContext),
// so the explorer's application-level guard cannot be imported into it and config `use` context options
// (serviceWorkers) never reach that context. The strongest feasible config-only lever is a Chromium
// launch argument, which applies to every context of the launched browser.
//
// --host-resolver-rules sends every hostname to NOTFOUND except the literal 127.0.0.1, so:
//   - any external host is unreachable (DNS fails) for HTTP and WebSocket;
//   - the hostname "localhost" is unreachable (it is not 127.0.0.1 literally);
//   - a SECOND 127.0.0.1 origin on a different PORT is NOT blocked: host-resolver rules cannot filter
//     ports. That residual gap is stated plainly and proven by `guard-journey`.
//
// serviceWorkers: 'block' is also set in `use`; it only covers fixture-created contexts, not the
// login context, so it is best-effort here. Off-origin service-worker scripts are blocked anyway
// because their origin fails to resolve.
export const CONTAINMENT_LAUNCH_ARGS = ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'];

export const CONTAINMENT_SUMMARY =
    'Chromium --host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1 (every host except literal 127.0.0.1 ' +
    'fails DNS; external hosts and localhost blocked for HTTP and WebSocket) plus serviceWorkers: block on ' +
    'fixture contexts. Residual gap: a second 127.0.0.1 origin on another port is not blocked (ports are not ' +
    'filterable by host-resolver rules) without editing the lib or the spec.';
