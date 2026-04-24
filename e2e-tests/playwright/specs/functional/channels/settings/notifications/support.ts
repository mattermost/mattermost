// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlaywrightExtended} from '@mattermost/playwright-lib';

export const highlightWithoutNotificationClass = 'non-notification-highlight';

/**
 * Generates the shared array of four randomized keywords used by the
 * highlight-without-notification specs.
 */
export function generateKeywords(pw: PlaywrightExtended): string[] {
    return [`AB${pw.random.id()}`, `CD${pw.random.id()}`, `EF${pw.random.id()}`, `Highlight me ${pw.random.id()}`];
}
