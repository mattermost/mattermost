// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    ArrowBackIosIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

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
                    <WithTooltip title={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}>
                        <IconButton
                            size='small'
                            className='sidebar--right__back'
                            icon={<Icon glyph={<ArrowBackIosIcon/>}/>}
                            onClick={goBack}
                            aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                        />
                    </WithTooltip>
                )}
                <h2>
                    <HeaderTitle
                        id='rhsPanelTitle'
                    >
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
                    icon={<Icon glyph={<CloseIcon/>}/>}
                    aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                    onClick={onClose}
                />
            </WithTooltip>
        </div>
    );
};

export default Header;
