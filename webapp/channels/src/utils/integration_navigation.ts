// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getHistory} from 'utils/browser_history';
import {getSiteURL, isUrlSafe} from 'utils/url';

/**
 * Client navigation for integration responses (slash commands, post actions, etc.)
 * that include goto_location — same rules as executeCommand.
 */
export function applyIntegrationGotoLocation(goToLocation: string | undefined): void {
    if (!goToLocation || !isUrlSafe(goToLocation)) {
        return;
    }
    if (goToLocation.startsWith('/')) {
        getHistory().push(goToLocation);
        return;
    }
    const siteURL = getSiteURL();
    if (goToLocation.startsWith(siteURL)) {
        getHistory().push(goToLocation.substring(siteURL.length));
        return;
    }
    window.open(goToLocation, '_blank', 'noopener,noreferrer');
}
