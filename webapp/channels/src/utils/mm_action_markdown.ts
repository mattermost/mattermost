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

    const actionId = url.host;
    const query = Object.fromEntries(url.searchParams.entries());

    return {actionId, query};
}
