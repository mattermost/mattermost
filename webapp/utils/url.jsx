// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export function cleanUpUrlable(input) {
    var cleaned = input.trim().replace(/-/g, ' ').replace(/[^\w\s]/gi, '').toLowerCase().replace(/\s/g, '-');
    cleaned = cleaned.replace(/-{2,}/, '-');
    cleaned = cleaned.replace(/^-+/, '');
    cleaned = cleaned.replace(/-+$/, '');
    return cleaned;
}

export function getShortenedTeamURL(teamURL = '') {
    if (teamURL.length > 35) {
        return teamURL.substring(0, 10) + '...' + teamURL.substring(teamURL.length - 12, teamURL.length) + '/';
    }
    return teamURL + '/';
}

export function getSiteURL() {
    if (global.mm_config.SiteURL) {
        return global.mm_config.SiteURL;
    }

    if (window.location.origin) {
        return window.location.origin;
    }

    return window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
}
