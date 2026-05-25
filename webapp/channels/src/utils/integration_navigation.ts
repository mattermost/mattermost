// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getHistory} from 'utils/browser_history';
import {getSiteURL, isUrlSafe} from 'utils/url';

/**
 * Client navigation for integration responses (slash commands, post actions, etc.)
 * that include goto_location — same rules as executeCommand.
 */
export function applyIntegrationGotoLocation(gotoLocation: string | undefined): void {
    if (!gotoLocation || !isUrlSafe(gotoLocation)) {
        return;
    }
    if (gotoLocation.startsWith('/')) {
        getHistory().push(gotoLocation);
        return;
    }
    const siteURL = getSiteURL();
    if (gotoLocation.startsWith(siteURL)) {
        getHistory().push(gotoLocation.substring(siteURL.length));
        return;
    }
    window.open(gotoLocation, '_blank', 'noopener,noreferrer');
}
