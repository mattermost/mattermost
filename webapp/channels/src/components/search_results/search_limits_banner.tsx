// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {isSearchTruncated} from 'mattermost-redux/selectors/entities/search';

import CenterMessageLock from 'components/center_message_lock';
import useGetServerLimits from 'components/common/hooks/useGetServerLimits';

import {DataSearchTypes} from 'utils/constants';

import './search_limits_banner.scss';

type Props = {
    searchType: string;
}

function SearchLimitsBanner(props: Props) {
    const [serverLimits] = useGetServerLimits();

    // Check if current search results were actually truncated
    const searchTruncated = useSelector((state: GlobalState) => {
        const searchType = props.searchType === DataSearchTypes.FILES_SEARCH_TYPE ? 'files' : 'posts';
        return isSearchTruncated(state, searchType);
    });

    // Only show banner if search results were actually truncated
    if (!searchTruncated || !serverLimits?.postHistoryLimit) {
        return null;
    }

    return (
        <div
            id={`${props.searchType}_search_limits_banner`}
            className='SearchLimitsBanner__wrapper'
        >
            <CenterMessageLock/>
        </div>
    );
}

export default SearchLimitsBanner;
