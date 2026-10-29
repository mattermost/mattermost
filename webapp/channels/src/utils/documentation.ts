// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const MATTERMOST_DOCS_URL = 'https://docs.mattermost.com';

const BUNDLED_DOCS_PATH = '/_documentation';

// Developer docs moved from developers.mattermost.com to docs.mattermost.com/developers.
const DOCS_HOSTS: Record<string, string> = {
    'docs.mattermost.com': '',
    'developers.mattermost.com': '/developers',
};

// Bundled docs live at /_documentation/ and only resolve when Mattermost is
// installed at the root of the host. A SiteURL subpath falls back to the public site.
function getBundledDocsOrigin(siteURL: string): string | undefined {
    try {
        const {origin, pathname} = new URL(siteURL);
        if (pathname === '/') {
            return origin;
        }
    } catch {
        // new URL throws for an empty or unparseable SiteURL.
    }

    return undefined;
}

export function getMattermostDocumentationURL(siteURL: string): string {
    const origin = getBundledDocsOrigin(siteURL);
    return origin ? `${origin}${BUNDLED_DOCS_PATH}/` : MATTERMOST_DOCS_URL;
}

/**
 * Rewrites a docs.mattermost.com or developers.mattermost.com link to the same page in the
 * documentation bundled with the server, when it is available. Any other URL is returned unchanged.
 */
export function getDocumentationURL(url: string, siteURL: string): string {
    let parsedURL;
    try {
        parsedURL = new URL(url);
    } catch {
        return url;
    }

    const prefix = DOCS_HOSTS[parsedURL.hostname];
    if (prefix === undefined || (parsedURL.protocol !== 'https:' && parsedURL.protocol !== 'http:')) {
        return url;
    }

    const origin = getBundledDocsOrigin(siteURL);
    if (!origin) {
        return url;
    }

    // The bundle is built with trailingSlash: false, and its client-side router only matches
    // clean URLs, so legacy ".html" suffixes and trailing slashes must be dropped.
    const pagePath = (prefix + parsedURL.pathname).replace(/\.html$/, '').replace(/\/+$/, '');

    return `${origin}${BUNDLED_DOCS_PATH}${pagePath || '/'}${parsedURL.search}${parsedURL.hash}`;
}
