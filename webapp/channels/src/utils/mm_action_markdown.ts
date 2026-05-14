// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function parseMmActionMarkdownHref(href: string): {actionId: string; query: Record<string, string>} | null {
    let url;
    try {
        url = new URL(href);
    } catch {
        return null;
    }

    if (url.protocol !== 'mmaction:') {
        return null;
    }

    // `mmaction:foo` puts the id in pathname; `mmaction://foo` uses host (per URL parsing rules).
    let actionId = url.host;
    if (!actionId) {
        actionId = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    }
    if (!actionId) {
        return null;
    }

    const query = Object.fromEntries(url.searchParams.entries());

    return {actionId, query};
}
