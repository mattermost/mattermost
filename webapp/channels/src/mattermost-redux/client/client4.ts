// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

getSharedChannels = (teamId: string, page = 0, perPage = PER_PAGE_DEFAULT) => {
    return this.doFetch<any>(
        `${this.getSharedChannelsRoute()}/${teamId}${buildQueryString({page, per_page: perPage})}`,
        {method: 'get'},
    );
};

getRemoteClusterInfo = (remoteId: string) => {
    return this.doFetch<any>(
        `${this.getSharedChannelsRoute()}/remote_info/${remoteId}`,
        {method: 'get'},
    );
};

getSharedChannelsRoute = () => {
    return `${this.getBaseRoute()}/sharedchannels`;
};
