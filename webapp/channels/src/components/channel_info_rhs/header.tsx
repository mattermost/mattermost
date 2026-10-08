// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

interface Props {
    channel: Channel;
    isMobile: boolean;
    onClose: () => void;
}

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

const Header = ({channel, isMobile, onClose}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>
                {isMobile && (
                    <WithTooltip title={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}>
                        <IconButton
                            size='small'
                            className='sidebar--right__back'
                            icon={
                                <i
                                    className='icon icon-arrow-back-ios'
                                    aria-hidden='true'
                                />
                            }
                            onClick={onClose}
                            aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                        />
                    </WithTooltip>
                )}
                <h2>
                    <HeaderTitle
                        id='rhsPanelTitle'
                    >
                        <FormattedMessage
                            id='channel_info_rhs.header.title'
                            defaultMessage='Info'
                        />
                    </HeaderTitle>
                    {channel.display_name &&
                    <span
                        className='style--none sidebar--right__title__subtitle'
                    >
                        {channel.display_name}
                    </span>
                    }
                </h2>
            </span>

            <WithTooltip
                title={
                    <FormattedMessage
                        id='rhs_header.closeSidebarTooltip'
                        defaultMessage='Close'
                    />
                }
            >
                <IconButton
                    id='rhsCloseButton'
                    size='small'
                    className='sidebar--right__close'
                    icon={
                        <i
                            className='icon icon-close'
                            aria-hidden='true'
                        />
                    }
                    aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                    onClick={onClose}
                />
            </WithTooltip>
        </div>
    );
};

export default Header;
