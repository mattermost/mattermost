// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, type WrappedComponentProps, injectIntl} from 'react-intl';
import styled from 'styled-components';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import LocalizedIcon from 'components/localized_icon';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {RHSStates} from 'utils/constants';
import {t} from 'utils/i18n';

import type {RhsState} from 'types/store/rhs';

const BackButton = styled.button`
    border: 0px;
    background: transparent;
`;

const BackButtonIcon = styled(LocalizedIcon)`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
`;

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
                        <BackButton
                            className='sidebar--right__back'
                            onClick={() => this.props.actions.goBack()}
                        >
                            <BackButtonIcon
                                className='icon-arrow-back-ios'
                                ariaLabel={{id: t('rhs_header.back.icon'), defaultMessage: 'Back Icon'}}
                            />
                        </BackButton>
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
                                    aria-label={this.props.intl.formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand Sidebar Icon'})}
                                />
                                <i
                                    className='icon icon-arrow-collapse'
                                    aria-label={this.props.intl.formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse Sidebar Icon'})}
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
                            onClick={this.props.actions.closeRightHandSide}
                        >
                            <i
                                className='icon icon-close'
                                aria-label={this.props.intl.formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                            />
                        </button>
                    </OverlayTrigger>
                </div>
            </div>
        );
    }
}

export default injectIntl(SearchResultsHeader);
