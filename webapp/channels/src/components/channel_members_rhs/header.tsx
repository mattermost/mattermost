// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';

import WithTooltip from 'components/with_tooltip';

interface Props {
    channel: Channel;
    canGoBack: boolean;

    onClose: () => void;
    goBack: () => void;
}

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

const Header = ({channel, canGoBack, onClose, goBack}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>

                {canGoBack && (
                    <button
                        className='sidebar--right__back btn btn-icon btn-sm'
                        onClick={goBack}
                        aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    >
                        <i
                            className='icon icon-arrow-back-ios'
                        />
                    </button>
                )}

                <HeaderTitle>
                    <FormattedMessage
                        id='channel_members_rhs.header.title'
                        defaultMessage='Members'
                    />
                </HeaderTitle>

                {channel.display_name &&
                    <span
                        className='style--none sidebar--right__title__subtitle'
                    >
                        {channel.display_name}
                    </span>
                }
            </span>

            <WithTooltip
                id='closeSidebarTooltip'
                placement='top'
                title={
                    <FormattedMessage
                        id='rhs_header.closeSidebarTooltip'
                        defaultMessage='Close'
                    />
                }
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
            </WithTooltip>
        </div>
    );
};

export default Header;
