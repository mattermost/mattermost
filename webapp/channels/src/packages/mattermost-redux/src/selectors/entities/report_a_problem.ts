// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getBrowserInfo, getDesktopVersion, getPlatformInfo, isDesktopApp} from 'mattermost-redux/utils/browser_info';

import {getConfig, isFreeEdition} from './general';
import {getCurrentTeamId} from './teams';
import {getCurrentUserId} from './users';

const MATTERMOST_REPORT_PROBLEM_EMAIL = 'reportaproblem@mattermost.com';

export function getReportAProblemLink(state: GlobalState): string {
    const config = getConfig(state);
    const type = config.ReportAProblemType;
    switch (type) {
    case 'email':
        return getSystemInfoMailtoLink(state, config.ReportAProblemMail);
    case 'link':
        if (config.ReportAProblemLink) {
            return config.ReportAProblemLink;
        }

        // falls through
    case 'default': {
        if (!isFreeEdition(state)) {
            return getDefaultReportAProblemMailtoLink(state);
        }
        return 'https://mattermost.com/pl/report_a_problem_unlicensed';
    }
    }
    return '';
}

export const getDefaultReportAProblemMailtoLink = createSelector(
    'getDefaultReportAProblemMailtoLink',
    getCurrentUserId,
    getCurrentTeamId,
    (state: GlobalState) => getConfig(state).Version,
    (state: GlobalState) => getConfig(state).BuildNumber,
    (currentUserId: string, currentTeamId: string, version: string | undefined, buildNumber: string | undefined) => {
        const {browser, browserVersion} = getBrowserInfo();
        const platformName = getPlatformInfo();

        let appLine = '';
        let logsInstructions = '';
        if (isDesktopApp()) {
            appLine = `Desktop Version: ${getDesktopVersion()}`;
            logsInstructions = 'desktop app logs (https://support.mattermost.com/hc/en-us/articles/37269786544916)';
        } else {
            appLine = `Browser: ${browser} ${browserVersion}`;
            logsInstructions = 'browser console logs (https://support.mattermost.com/hc/en-us/articles/35971622382484)';
        }

        const subject = 'Problem with Mattermost app';
        const body =
            `Please share a description of the problem with reproduction steps:


You may also attach any relevant screenshots and ${logsInstructions}, if applicable:

App metadata:
- Current User Id: ${currentUserId}
- Current Team Id: ${currentTeamId}
- Server Version: ${version} (Build ${buildNumber})
- App Platform: ${platformName}
- ${appLine}`.trim();

        return `mailto:${MATTERMOST_REPORT_PROBLEM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
);

export const getSystemInfoMailtoLink = createSelector(
    'getSystemInfoMailtoLink',
    getCurrentUserId,
    getCurrentTeamId,
    (state: GlobalState) => getConfig(state).Version,
    (state: GlobalState) => getConfig(state).BuildNumber,
    (state: GlobalState) => getConfig(state).SiteName,
    (state: GlobalState, supportEmail: string | undefined) => supportEmail,
    (currentUserId: string, currentTeamId: string, version: string | undefined, buildNumber: string | undefined, siteName: string | undefined, supportEmail: string | undefined) => {
        const {browser, browserVersion} = getBrowserInfo();
        const platformName = getPlatformInfo();

        const subject = `Problem with ${siteName || 'Mattermost'} app`;
        const body = `
System Information:
- User ID: ${currentUserId}
- Team ID: ${currentTeamId}
- Server Version: ${version} (${buildNumber})
- Browser: ${browser} ${browserVersion}
- Platform: ${platformName}
`.trim();

        return `mailto:${supportEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },
);
