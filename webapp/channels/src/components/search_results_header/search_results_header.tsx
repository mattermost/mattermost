// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {RHSStates} from 'utils/constants';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux {
    children: React.ReactNode;
}

function SearchResultsHeader(props: Props) {
    const {formatMessage} = useIntl();

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

    const showExpand = props.previousRhsState !== RHSStates.CHANNEL_INFO;

    return (
        <div className='sidebar--right__header'>
            <span className='sidebar--right__title'>
                {props.canGoBack && (
                    <button
                        className='sidebar--right__back btn btn-icon btn-sm'
                        onClick={props.actions.goBack}
                        aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    >
                        <i className='icon icon-arrow-back-ios'/>
                    </button>
                )}
                {props.children}
            </span>
            <div className='pull-right'>
                {showExpand && (
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='bottom'
                        overlay={props.isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn btn-icon btn-sm'
                            onClick={props.actions.toggleRhsExpanded}
                        >
                            <i
                                className='icon icon-arrow-expand'
                                aria-label={formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand Sidebar Icon'})}
                            />
                            <i
                                className='icon icon-arrow-collapse'
                                aria-label={formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse Sidebar Icon'})}
                            />
                        </button>
                    </OverlayTrigger>
                )}
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={closeSidebarTooltip}
                >
                    <button
                        id='searchResultsCloseButton'
                        type='button'
                        className='sidebar--right__close btn btn-icon btn-sm'
                        aria-label='Close'
                        onClick={props.actions.closeRightHandSide}
                    >
                        <i
                            className='icon icon-close'
                            aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                        />
                    </button>
                </OverlayTrigger>
            </div>
        </div>
    );
}

export default SearchResultsHeader;
