// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, type WrappedComponentProps, injectIntl} from 'react-intl';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

interface Props extends WrappedComponentProps {
    isExpanded: boolean;
    previousRhsState?: RhsState;
    canGoBack: boolean;
    children?: React.ReactNode;
    actions: {
        closeRightHandSide: () => void;
        toggleRhsExpanded: () => void;
        goBack: () => void;
    };
}

class SearchResultsHeader extends React.PureComponent<Props> {
    render(): React.ReactNode {
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

        const showExpand = this.props.previousRhsState !== RHSStates.CHANNEL_INFO;

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {this.props.canGoBack && (
                        <button
                            className='sidebar--right__back btn btn-icon btn-xs'
                            onClick={this.props.actions.goBack}
                            aria-label={this.props.intl.formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Go back'})}
                        >
                            <i className='icon icon-arrow-back-ios'/>
                        </button>
                    )}
                    {this.props.children}
                </span>

                <div className='pull-right'>
                    {showExpand && (
                        <OverlayTrigger
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='bottom'
                            overlay={this.props.isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
                        >
                            <button
                                type='button'
                                className='sidebar--right__expand btn btn-icon btn-sm'
                                onClick={this.props.actions.toggleRhsExpanded}
                            >
                                <i
                                    className='icon icon-arrow-expand'
                                    aria-label={this.props.intl.formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand sidebar'})}
                                />
                                <i
                                    className='icon icon-arrow-collapse'
                                    aria-label={this.props.intl.formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse sidebar'})}
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
                            aria-label={this.props.intl.formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close sidebar'})}
                            onClick={this.props.actions.closeRightHandSide}
                        >
                            <i
                                className='icon icon-close'
                            />
                        </button>
                    </OverlayTrigger>
                </div>
            </div>
        );
    }
}

export default injectIntl(SearchResultsHeader);
