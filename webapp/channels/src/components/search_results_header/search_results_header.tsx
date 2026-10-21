// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    ArrowBackIosIcon,
    ArrowCollapseIcon,
    ArrowExpandIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import PopoutButton from 'components/popout_button';

import {RHSStates} from 'utils/constants';
import {isChannelPopoutWindow, isPopoutWindow} from 'utils/popouts/popout_windows';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux {
    children: React.ReactNode;
    newWindowHandler?: () => void;
}

function SearchResultsHeader(props: Props) {
    const {formatMessage} = useIntl();

    const showExpand = props.previousRhsState !== RHSStates.CHANNEL_INFO;

    const sidebarTooltipContent = props.isExpanded ? (
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
    ) : (
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

    const expandOrCollapseSidebarButtonAriaLabel = props.isExpanded ? formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse Sidebar Icon'}) : formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand Sidebar Icon'});

    return (
        <div className='sidebar--right__header'>
            <span
                className='sidebar--right__title'
                id='rhsPanelTitle'
            >
                {props.canGoBack && (
                    <WithTooltip title={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}>
                        <IconButton
                            size='small'
                            className='sidebar--right__back'
                            icon={<Icon glyph={<ArrowBackIosIcon/>}/>}
                            onClick={props.actions.goBack}
                            aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                        />
                    </WithTooltip>
                )}
                {props.children}
            </span>
            <div className='pull-right'>
                {showExpand && !isPopoutWindow() && (
                    <WithTooltip title={sidebarTooltipContent}>
                        <IconButton
                            size='small'
                            className='sidebar--right__expand'
                            icon={<Icon glyph={props.isExpanded ? <ArrowCollapseIcon/> : <ArrowExpandIcon/>}/>}
                            onClick={props.actions.toggleRhsExpanded}
                            aria-label={expandOrCollapseSidebarButtonAriaLabel}
                        />
                    </WithTooltip>
                )}
                {props.newWindowHandler && (
                    <PopoutButton onClick={props.newWindowHandler}/>
                )}
                {(!isPopoutWindow() || isChannelPopoutWindow()) &&
                    <WithTooltip
                        title={
                            <FormattedMessage
                                id='rhs_header.closeSidebarTooltip'
                                defaultMessage='Close'
                            />
                        }
                    >
                        <IconButton
                            id='searchResultsCloseButton'
                            size='small'
                            className='sidebar--right__close'
                            icon={<Icon glyph={<CloseIcon/>}/>}
                            aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                            onClick={props.actions.closeRightHandSide}
                        />
                    </WithTooltip>
                }
            </div>
        </div>
    );
}

export default SearchResultsHeader;
