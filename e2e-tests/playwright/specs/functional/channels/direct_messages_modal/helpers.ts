// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * Returns the current channel slug (the last path segment) from the page URL,
 * e.g. the group-message name from `/team/messages/<slug>`.
 */
export function getChannelSlugFromUrl(page: Page): string {
    return new URL(page.url()).pathname.split('/').pop() as string;
}
