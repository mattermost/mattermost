// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

// @ts-ignore
const WebappUtils = window.WebappUtils;

type PathLike = {
    pathname: string;
    search: string;
}

export const navigateToUrl = (urlPath: string | PathLike) => {
    WebappUtils.browserHistory.push(urlPath);
};

export const pluginUrl = (urlPath: string) => {
    return '/playbooks' + urlPath;
};

export const navigateToPluginUrl = (urlPath: string) => {
    WebappUtils.browserHistory.push(pluginUrl(urlPath));
};

/**
 * Navigate to channel given a channelId and teamName
 */
export const navigateToChannel = async (teamName: string, channelId: string) => {
    navigateToUrl(`/${teamName}/channels/${channelId}`);
};

export const pluginErrorUrl = (type: string) => {
    return pluginUrl(`/error?type=${type}`);
};

export const handleFormattedTextClick = (e: React.MouseEvent<HTMLElement, MouseEvent>, currentRelativeTeamUrl: string) => {
    // @ts-ignore
    const channelMentionAttribute = e.target.getAttributeNode('data-channel-mention');

    if (channelMentionAttribute) {
        e.preventDefault();
        navigateToUrl(currentRelativeTeamUrl + '/channels/' + channelMentionAttribute.value);
    }
};
