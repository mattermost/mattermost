// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {ChannelBookmarksState} from '@mattermost/types/channel_bookmarks';
import type {GlobalState} from '@mattermost/types/store';

import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';

import {LicenseSkus} from 'utils/constants';

export const useIsChannelBookmarksEnabled = () => {
    return useSelector(getIsChannelBookmarksEnabled);
};

export const getIsChannelBookmarksEnabled = (state: GlobalState) => {
    const isEnabled = getFeatureFlagValue(state, 'ChannelBookmarks') === 'true';

    if (!isEnabled) {
        return false;
    }

    const license = getLicense(state);

    const isLicensed = license?.IsLicensed === 'true';

    // Channel Bookmarks is available for Professional & Enterprise, and is backward compatible with E20 & E10
    return (
        isLicensed &&
        (
            license.SkuShortName === LicenseSkus.Professional ||
            license.SkuShortName === LicenseSkus.Enterprise ||
            license.SkuShortName === LicenseSkus.E20 ||
            license.SkuShortName === LicenseSkus.E10
        )
    );
};

const EMPTY_BOOKMARKS = {};

export const getChannelBookmarks = (state: GlobalState, channelId: string): ChannelBookmarksState['byChannelId'][string] => {
    const bookmarks = state.entities.channelBookmarks.byChannelId[channelId];

    if (!bookmarks) {
        return EMPTY_BOOKMARKS;
    }

    return bookmarks;
};

export const getChannelBookmark = (state: GlobalState, channelId: string, bookmarkId: string) => {
    return getChannelBookmarks(state, channelId)?.[bookmarkId];
};

export const useChannelBookmarks = (channelId: string) => {
    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));

    const order = useMemo(() => {
        return Object.keys(bookmarks).sort((a, b) => bookmarks[a].sort_order - bookmarks[b].sort_order);
    }, [bookmarks]);

    return {
        bookmarks,
        order,
    };
};
