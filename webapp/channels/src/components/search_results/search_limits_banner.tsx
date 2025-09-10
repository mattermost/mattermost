// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {EyeOffOutlineIcon} from '@mattermost/compass-icons/components';
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
color: rgba(var(--center-channel-color-rgb), 0.8);
font-weight: 400;
font-size: 14px;
line-height: 16px;
letter-spacing: 0.02em;
`;

const StyledTitle = styled.div`
padding-bottom: 8px;
font-size: 14px;
font-weight: 600;
`;

const StyledIcon = styled.div`
align-self: flex-start;
padding: 0 12px;
`;

type Props = {
    searchType: string;
}

function SearchLimitsBanner(props: Props) {
    const {formatMessage} = useIntl();
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

    const bannerMessage = formatMessage({
        id: 'workspace_limits.search_limit.banner_text',
        defaultMessage: 'Full access to message history is included in <a>paid plans</a>',
    }, {
        a: (chunks: React.ReactNode) => (
            <StyledA onClick={() => openPricingModal()}>
                {chunks}
            </StyledA>
        ),
    });

    return (
        <StyledDiv id={`${props.searchType}_search_limits_banner`}>
            <InnerDiv>
                <StyledIcon className='CenterMessageLock__left'>
                    <EyeOffOutlineIcon
                        size={16}
                        color={'rgba(var(--center-channel-color-rgb), 0.75)'}
                    />
                </StyledIcon>
                <div>
                    <StyledTitle>
                        <FormattedMessage
                            id='workspace_limits.message_history.locked.title.admin'
                            defaultMessage='Limited history is displayed'
                        />
                    </StyledTitle>
                    <div>
                        {bannerMessage}
                    </div>
                </div>
            </InnerDiv>
        </StyledDiv>
    );
}

export default SearchLimitsBanner;
