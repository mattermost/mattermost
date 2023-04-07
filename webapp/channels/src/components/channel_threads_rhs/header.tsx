// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import Constants from 'utils/constants';
import {Channel} from '@mattermost/types/channels';
import LocalizedIcon from 'components/localized_icon';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {t} from 'utils/i18n';
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
    const closeSidebarTooltip = (
        <Tooltip id='closeSidebarTooltip'>
            <FormattedMessage
                id='rhs_header.closeSidebarTooltip'
                defaultMessage='Close'
            />
        </Tooltip>
    );

    const expandSidebarTooltip = (
        <Tooltip id='expandSidebarTooltip'>
            <FormattedMessage
                id='rhs_header.expandSidebarTooltip'
                defaultMessage='Expand the right sidebar'
            />
            <KeyboardShortcutSequence
                shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}
                hideDescription={true}
                isInsideTooltip={true}
            />
        </Tooltip>
    );

    const shrinkSidebarTooltip = (
        <Tooltip id='shrinkSidebarTooltip'>
            <FormattedMessage
                id='rhs_header.collapseSidebarTooltip'
                defaultMessage='Collapse the right sidebar'
            />
            <KeyboardShortcutSequence
                shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}
                hideDescription={true}
                isInsideTooltip={true}
            />
        </Tooltip>
    );

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>

                {canGoBack && (
                    <BackButton
                        className='sidebar--right__back'
                        onClick={goBack}
                    >
                        <i
                            className='icon icon-arrow-back-ios'
                            aria-label='Back Icon'
                        />
                    </BackButton>
                )}

                <HeaderTitle>
                    <FormattedMessage
                        id='channel_threads_rhs.header.title'
                        defaultMessage='All Threads'
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

            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='bottom'
                overlay={isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
            >
                <button
                    type='button'
                    className='sidebar--right__expand btn-icon'
                    onClick={toggleRhsExpanded}
                >
                    <LocalizedIcon
                        className='icon icon-arrow-expand'
                        ariaLabel={{id: t('rhs_header.expandSidebarTooltip.icon'), defaultMessage: 'Expand Sidebar Icon'}}
                    />
                    <LocalizedIcon
                        className='icon icon-arrow-collapse'
                        ariaLabel={{id: t('rhs_header.collapseSidebarTooltip.icon'), defaultMessage: 'Collapse Sidebar Icon'}}
                    />
                </button>
            </OverlayTrigger>

            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={closeSidebarTooltip}
            >
                <button
                    id='rhsCloseButton'
                    type='button'
                    className='sidebar--right__close btn-icon'
                    aria-label='Close'
                    onClick={onClose}
                >
                    <LocalizedIcon
                        className='icon icon-close'
                        ariaLabel={{id: t('rhs_header.closeTooltip.icon'), defaultMessage: 'Close Sidebar Icon'}}
                    />
                </button>
            </OverlayTrigger>
        </div>
    );
};

export default Header;
