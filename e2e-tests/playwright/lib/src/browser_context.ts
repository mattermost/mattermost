// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';

import type {Browser, BrowserContext, Page} from '@playwright/test';
import {request} from '@playwright/test';
import type {UserProfile} from '@mattermost/types/users';

import {testConfig} from './test_config';
import {pages} from './ui/pages';
import {resolvePlaywrightPath} from './util';

export class TestBrowser {
    readonly browser: Browser;
    private contexts: BrowserContext[] = [];

    constructor(browser: Browser) {
        this.browser = browser;
    }

    async login(user: UserProfile) {
        const options = {storageState: '', ignoreHTTPSErrors: true};
        if (user) {
            // Log in via API request and save user storage
            const storagePath = await loginByAPI(user.username, user.password);
            options.storageState = storagePath;
        }

        // Sign in a user in new browser context
        const context = await this.browser.newContext(options);
        await routeInternalBaseUrlToHost(context);
        const page = await context.newPage();
        patchGotoToUseBaseUrl(page);

        const channelsPage = new pages.ChannelsPage(page);
        const systemConsolePage = new pages.SystemConsolePage(page);
        const scheduledPostsPage = new pages.ScheduledPostsPage(page);
        const draftsPage = new pages.DraftsPage(page);
        const recapsPage = new pages.RecapsPage(page);
        const threadsPage = new pages.ThreadsPage(page);
        const contentReviewPage = new pages.ContentReviewPage(page);

        this.contexts.push(context);

        return {
            context,
            page,
            channelsPage,
            systemConsolePage,
            scheduledPostsPage,
            draftsPage,
            recapsPage,
            threadsPage,
            contentReviewPage,
        };
    }

    /** Unauthenticated context/page for specs that need custom context options (e.g. userAgent). */
    async newPage(options: Parameters<Browser['newContext']>[0] = {}) {
        const context = await this.browser.newContext(options);
        await routeInternalBaseUrlToHost(context);
        const page = await context.newPage();
        patchGotoToUseBaseUrl(page);

        this.contexts.push(context);

        return {context, page};
    }

    /**
     * Switch the auth state of an existing context to a different user
     * without creating a new context. After switching, pages in the context
     * should be reloaded to pick up the new auth state.
     */
    async switchUser(context: BrowserContext, user: UserProfile) {
        const storagePath = await loginByAPI(user.username, user.password);
        await (context as any).setStorageState(storagePath);
    }

    async close() {
        for (const context of this.contexts) {
            await context.close();
        }
        this.contexts = [];
    }
}

/**
 * Plugin webapp bundles build absolute URLs from ServiceSettings.SiteURL, which in `testcontainers`
 * mode is a Docker network alias that only other containers can resolve. Left alone those fetches
 * hang from the host browser, so anything waiting on network idle never settles. Rewrite them onto
 * the host-mapped URL, which serves the same server. No-op in `external` mode, where the two match.
 */
async function routeInternalBaseUrlToHost(context: BrowserContext) {
    const {internalBaseURL, baseURL} = testConfig;
    if (internalBaseURL === baseURL) {
        return;
    }

    await context.route(`${internalBaseURL}/**`, async (route) => {
        await route.continue({url: route.request().url().replace(internalBaseURL, baseURL)});
    });
}

/**
 * Playwright's own baseURL merging (`new URL(url, baseURL)`, used when `page.goto()` gets a path
 * instead of a full URL) replaces baseURL's pathname rather than appending to it, silently dropping
 * any path segment baseURL has — e.g. a subpath deployment's prefix. It's also frozen to whatever
 * testConfig.baseURL was at config-load time. This makes goto() resolve against the current
 * testConfig.baseURL instead, preserving its path segment, for every navigation given a path rather
 * than an already-absolute URL (external logins, permalinks, about:blank, etc. pass through as-is).
 */
export function patchGotoToUseBaseUrl(page: Page): void {
    const originalGoto = page.goto.bind(page);
    page.goto = ((url: string, options?: Parameters<Page['goto']>[1]) =>
        originalGoto(resolveAgainstBaseUrl(url), options)) as Page['goto'];
}

function resolveAgainstBaseUrl(target: string): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
        return target;
    }

    const given = new URL(target, 'http://placeholder.invalid');
    const url = new URL(testConfig.baseURL);
    url.pathname = `${url.pathname.replace(/\/+$/, '')}${given.pathname.startsWith('/') ? given.pathname : `/${given.pathname}`}`;
    url.search = given.search;
    url.hash = given.hash;
    return url.href;
}

export async function loginByAPI(loginId: string, password: string, token = '', ldapOnly = false) {
    const requestContext = await request.newContext({ignoreHTTPSErrors: true});

    const data: any = {
        login_id: loginId,
        password,
        token,
        deviceId: '',
    };

    if (ldapOnly) {
        data.ldap_only = 'true';
    }

    // Log in via API
    await requestContext.post(`${testConfig.baseURL}/api/v4/users/login`, {
        data,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
    });

    // Save signed-in state to a folder
    const storageStateDir = resolvePlaywrightPath('storage_state');

    // Ensure storage_state directory exists
    if (!fs.existsSync(storageStateDir)) {
        fs.mkdirSync(storageStateDir, {recursive: true});
    }

    const filename = `${Date.now()}_${loginId}_${password}${token ? '_' + token : ''}${ldapOnly ? '_ldap' : ''}.json`;
    const storagePath = path.join(storageStateDir, filename);
    const storageState = await requestContext.storageState({path: storagePath});
    await requestContext.dispose();

    // Append origins to bypass seeing landing page then write to file
    storageState.origins.push({
        origin: testConfig.baseURL,
        localStorage: [{name: '__landingPageSeen__', value: 'true'}],
    });
    await writeFile(storagePath, JSON.stringify(storageState));

    return storagePath;
}
