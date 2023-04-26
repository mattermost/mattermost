// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {Channel} from '@mattermost/types/channels';
import LocalizedIcon from 'components/localized_icon';
import SimpleTooltip from 'components/widgets/simple_tooltip';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

type Props = {
    canGoBack: boolean;
    channel: Channel;
    isExpanded: boolean;

    goBack: () => void;
    onClose: () => void;
    toggleRhsExpanded: () => void;
}

const BackButton = styled.button`
    border: 0;
    background: transparent;
`;

const HeaderTitle = styled.span`
    line-height: 2.4rem;
`;

const Header = ({
    canGoBack,
    channel,
    goBack,
    isExpanded,
    onClose,
    toggleRhsExpanded,
}: Props) => {
    const {formatMessage} = useIntl();

    let expandAriaLabel = formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand Sidebar Icon'});
    let expandSidebarTooltip = (
        <>
            <FormattedMessage
                id='rhs_header.expandSidebarTooltip'
                defaultMessage='Expand the right sidebar'
            />
            <KeyboardShortcutSequence
                shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}
                hideDescription={true}
                isInsideTooltip={true}
            />
        </>
    );

    if (isExpanded) {
        expandAriaLabel = formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse Sidebar Icon'});
        expandSidebarTooltip = (
            <>
                <FormattedMessage
                    id='rhs_header.collapseSidebarTooltip'
                    defaultMessage='Collapse the right sidebar'
                />
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}
                    hideDescription={true}
                    isInsideTooltip={true}
                />
            </>
        );
    }

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>

                {canGoBack && (
                    <BackButton
                        className='sidebar--right__back'
                        onClick={goBack}
                        aria-label={formatMessage({id: 'generic_icons.back', defaultMessage: 'Back Icon'})}
                    >
                        <i className='icon icon-arrow-back-ios'/>
                    </BackButton>
                )}

                <HeaderTitle>
                    <FormattedMessage
                        id='channel_threads_rhs.header.title'
                        defaultMessage='All Threads'
                    />
                </HeaderTitle>

                {channel.display_name &&
                    <span className='style--none sidebar--right__title__subtitle'>
                        {channel.display_name}
                    </span>
                }
            </span>
            <SimpleTooltip
                id='channelThreadsExpandIcon'
                content={expandSidebarTooltip}
                placement='bottom'
            >
                <button
                    type='button'
                    className='sidebar--right__expand btn-icon'
                    onClick={toggleRhsExpanded}
                    aria-label={expandAriaLabel}
                >
                    <LocalizedIcon className='icon icon-arrow-expand'/>
                    <LocalizedIcon className='icon icon-arrow-collapse'/>
                </button>
            </SimpleTooltip>

            <SimpleTooltip
                id='channelThreadsCloseIcon'
                content={(
                    <FormattedMessage
                        id='rhs_header.closeSidebarTooltip'
                        defaultMessage='Close'
                    />
                )}
                placement='bottom'
            >
                <button
                    id='rhsCloseButton'
                    type='button'
                    className='sidebar--right__close btn-icon'
                    onClick={onClose}
                    aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                >
                    <LocalizedIcon
                        className='icon icon-close'
                    />
                </button>
            </SimpleTooltip>
        </div>
    );
};

export default Header;
