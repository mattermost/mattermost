// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
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
