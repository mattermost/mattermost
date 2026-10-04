// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

/**
 * Builds a `/pl/` permalink using the SiteURL the running server reports.
 *
 * Do not assemble these from `testConfig.internalBaseURL`: `pw.ensureSiteUrl()` can
 * leave a host-facing SiteURL on a reused server, and the server only treats a URL
 * as a permalink when it is prefixed by its own SiteURL.
 *
 * Uses the client config endpoint so a non-admin test user can call it.
 */
export async function permalinkUrl(
    client: Pick<Client4, 'getClientConfig'>,
    teamName: string,
    postId: string,
): Promise<string> {
    const {SiteURL} = await client.getClientConfig();
    const siteUrl = (SiteURL ?? '').replace(/\/+$/, '');
    if (!siteUrl) {
        throw new Error('permalinkUrl: server SiteURL is empty');
    }
    return `${siteUrl}/${teamName}/pl/${postId}`;
}
