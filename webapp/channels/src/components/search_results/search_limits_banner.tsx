// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import type {GlobalState} from '@mattermost/types/store';

import {isSearchTruncated} from 'mattermost-redux/selectors/entities/search';

import useGetServerLimits from 'components/common/hooks/useGetServerLimits';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {DataSearchTypes} from 'utils/constants';

const StyledDiv = styled.div`
width: 100%;
`;

const StyledA = styled.a`
color: var(--button-bg) !important;
`;

const InnerDiv = styled.div`
display: flex;
gap: 8px;
border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
border-radius: 4px;
background-color: rgba(var(--center-channel-color-rgb), 0.04);
padding: 10px;
margin: 10px;
color: rgba(var(--center-channel-color-rgb), 0.75);
font-weight: 400;
font-size: 11px;
line-height: 16px;
letter-spacing: 0.02em;
`;

type Props = {
    searchType: string;
}

function SearchLimitsBanner(props: Props) {
    const {formatMessage, formatNumber} = useIntl();
    const {openPricingModal} = useOpenPricingModal();
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

    const limit = formatNumber(serverLimits.postHistoryLimit);
    const searchContent = props.searchType === DataSearchTypes.FILES_SEARCH_TYPE ? 'files' : 'messages';

    const ctaAction = formatMessage({
        id: 'workspace_limits.search_limit.view_plans',
        defaultMessage: 'View plans',
    });

    const bannerMessage = formatMessage({
        id: 'workspace_limits.search_limit.banner_text',
        defaultMessage: 'Some older {searchContent} were not shown because your workspace has over {limit} messages. <a>{ctaAction}</a>',
    }, {
        searchContent,
        limit,
        ctaAction,
        a: (chunks: React.ReactNode) => (
            <StyledA onClick={() => openPricingModal({trackingLocation: 'search_limits_banner'})}>
                {chunks}
            </StyledA>
        ),
    });

    return (
        <StyledDiv id={`${props.searchType}_search_limits_banner`}>
            <InnerDiv>
                <i className='icon-eye-off-outline'/>
                <span>{bannerMessage}</span>
            </InnerDiv>
        </StyledDiv>
    );
}

export default SearchLimitsBanner;
