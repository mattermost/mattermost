// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isAdmin} from 'mattermost-redux/utils/user_utils';

import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {DataSearchTypes} from 'utils/constants';
import {asGBString} from 'utils/limits';

const StyledDiv = styled.div`
width: 100%;
`;

const StyledA = styled.a`
color: var(--denim-button-bg) !important;
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
    const openPricingModal = useOpenPricingModal();
    const usage = useGetUsage();
    const [cloudLimits] = useGetLimits();
    const isAdminUser = isAdmin(useSelector(getCurrentUser).roles);
    const isCloud = useSelector(isCurrentLicenseCloud);

    if (!isCloud) {
        return null;
    }

    const currentFileStorageUsage = usage.files.totalStorage;
    const fileStorageLimit = cloudLimits?.files?.total_storage;
    const currentMessagesUsage = usage.messages.history;
    const messagesLimit = cloudLimits?.messages?.history;

    let ctaAction = formatMessage({
        id: 'workspace_limits.search_limit.view_plans',
        defaultMessage: 'View plans',
    });

    if (isAdminUser) {
        ctaAction = formatMessage({
            id: 'workspace_limits.search_limit.upgrade_now',
            defaultMessage: 'Upgrade now',
        });
    }

    const renderBanner = (bannerText: React.ReactNode, id: string) => {
        return (<StyledDiv id={id}>
            <InnerDiv>
                <i className='icon-eye-off-outline'/>
                <span>{bannerText}</span>
            </InnerDiv>
        </StyledDiv>);
    };

    switch (props.searchType) {
    case DataSearchTypes.FILES_SEARCH_TYPE:
        if ((fileStorageLimit === undefined) || !(currentFileStorageUsage > fileStorageLimit)) {
            return null;
        }
        return renderBanner(formatMessage({
            id: 'workspace_limits.search_files_limit.banner_text',
            defaultMessage: 'Some older files may not be shown because your workspace has met its file storage limit of {storage}. <a>{ctaAction}</a>',
        }, {
            ctaAction,
            storage: asGBString(fileStorageLimit, formatNumber),
            a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                <StyledA
                    onClick={() => openPricingModal({trackingLocation: 'file_search_limits_banner'})}
                >
                    {chunks}
                </StyledA>
            ),
        }), `${DataSearchTypes.FILES_SEARCH_TYPE}_search_limits_banner`);

    case DataSearchTypes.MESSAGES_SEARCH_TYPE:
        if ((messagesLimit === undefined) || !(currentMessagesUsage > messagesLimit)) {
            return null;
        }
        return renderBanner(formatMessage({
            id: 'workspace_limits.search_message_limit.banner_text',
            defaultMessage: 'Some older messages may not be shown because your workspace has over {messages} messages. <a>{ctaAction}</a>',
        }, {
            ctaAction,
            messages: formatNumber(messagesLimit),
            a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                <StyledA
                    onClick={() => openPricingModal({trackingLocation: 'messages_search_limits_banner'})}
                >
                    {chunks}
                </StyledA>
            ),
        }), `${DataSearchTypes.MESSAGES_SEARCH_TYPE}_search_limits_banner`);
    default:
        return null;
    }
}

export default SearchLimitsBanner;
