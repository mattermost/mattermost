// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

interface Props {
    channel: Channel;
    isArchived: boolean;
    isMobile: boolean;
    onClose: () => void;
}

const Icon = styled.i`
    font-size:12px;
`;

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

const Header = ({channel, isArchived, isMobile, onClose}: Props) => {
    const {formatMessage} = useIntl();
    const closeSidebarTooltip = (
        <Tooltip id='closeSidebarTooltip'>
            <FormattedMessage
                id='rhs_header.closeSidebarTooltip'
                defaultMessage='Close'
            />
        </Tooltip>
    );

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>
                {isMobile && (
                    <button
                        className='sidebar--right__back btn btn-icon btn-sm'
                        onClick={onClose}
                        aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    >
                        <i
                            className='icon icon-arrow-back-ios'
                        />
                    </button>
                )}
                <HeaderTitle>
                    <FormattedMessage
                        id='channel_info_rhs.header.title'
                        defaultMessage='Info'
                    />
                </HeaderTitle>

                {channel.display_name &&
                <span
                    className='style--none sidebar--right__title__subtitle'
                >
                    {isArchived && (<Icon className='icon icon-archive-outline'/>)}
                    {channel.display_name}
                </span>
                }
            </span>

            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={closeSidebarTooltip}
            >
                <button
                    id='rhsCloseButton'
                    type='button'
                    className='sidebar--right__close btn btn-icon btn-sm'
                    aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                    onClick={onClose}
                >
                    <i
                        className='icon icon-close'
                    />
                </button>
            </OverlayTrigger>
        </div>
    );
};

export default Header;
