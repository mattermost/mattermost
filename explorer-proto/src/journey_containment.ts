// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {containmentLaunchArgs} from './containment_proxy.ts';

// Containment for the UNMODIFIED repo-native spec run through explorer-proto/playwright.config.ts in
// replay-journey mode. The spec uses plain repo fixtures (pw.testBrowser.login -> browser.newContext), so
// the explorer's application-level guard cannot be imported into it. What does reach the lib's context is
// the config: `use.launchOptions` configures the browser every fixture and the lib share, and
// `use.serviceWorkers` is applied to contexts the lib creates through browser.newContext (verified by
// guard-journey: the worker script is never requested).
//
// All browser traffic is sent through a local filtering proxy started by the CLI before Playwright. It
// forwards only the exact approved host:port and answers everything else 403 before opening any upstream
// socket. --proxy-bypass-list=<-loopback> removes Chromium's implicit loopback bypass; without it
// 127.0.0.1 and localhost never reach the proxy (guard-journey proves this with a control).
// --host-resolver-rules stays as a second layer for anything that resolves a name locally.

export const PROXY_PORT_ENV = 'EXPLORER_CONTAINMENT_PROXY_PORT';
export const UNCONTAINED_CONTROL = 'off';

/** Launch args for the thin config. Fails closed: replay-journey without a proxy is refused, not run uncontained. */
export function thinContainmentLaunchArgs(mode: string, env: NodeJS.ProcessEnv = process.env): string[] {
    const value = env[PROXY_PORT_ENV];
    if (mode === 'guard-journey-spec' && value === UNCONTAINED_CONTROL) {
        return [];
    }
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(
            `${mode} must be started through "node explorer-proto/src/cli.ts", which starts the containment proxy and sets ${PROXY_PORT_ENV}.`,
        );
    }
    return containmentLaunchArgs(port);
}

export const CONTAINMENT_SUMMARY =
    'all browser traffic through a local filtering proxy that forwards only the exact approved host:port and ' +
    'answers everything else 403 before opening an upstream socket (--proxy-server, --proxy-bypass-list=<-loopback>), ' +
    'plus --host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1 and serviceWorkers: block on contexts the lib creates.';
