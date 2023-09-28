// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import LocalizedIcon from 'components/localized_icon';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {RHSStates} from 'utils/constants';
import {t} from 'utils/i18n';

import type {RhsState} from 'types/store/rhs';

type Props = {
    previousRhsState?: RhsState;
    isExpanded: boolean;
    actions: {
        showMentions: () => void;
        showSearchResults: () => void;
        showFlaggedPosts: () => void;
        showPinnedPosts: () => void;
        closeRightHandSide: () => void;
        toggleRhsExpanded: () => void;
    };
};

export default class RhsCardHeader extends React.PureComponent<Props> {
    handleBack = (e: React.MouseEvent<HTMLAnchorElement>): void => {
        e.preventDefault();

        switch (this.props.previousRhsState) {
        case RHSStates.CHANNEL_FILES:
            this.props.actions.showSearchResults();
            break;
        case RHSStates.SEARCH:
            this.props.actions.showSearchResults();
            break;
        case RHSStates.MENTION:
            this.props.actions.showMentions();
            break;
        case RHSStates.FLAG:
            this.props.actions.showFlaggedPosts();
            break;
        case RHSStates.PIN:
            this.props.actions.showPinnedPosts();
            break;
        default:
            break;
        }
    };

    render(): React.ReactNode {
        let back;
        let backToResultsTooltip;

        switch (this.props.previousRhsState) {
        case RHSStates.SEARCH:
        case RHSStates.MENTION:
            backToResultsTooltip = (
                <Tooltip id='backToResultsTooltip'>
                    <FormattedMessage
                        id='rhs_header.backToResultsTooltip'
                        defaultMessage='Back to search results'
                    />
                </Tooltip>
            );
            break;
        case RHSStates.FLAG:
            backToResultsTooltip = (
                <Tooltip id='backToResultsTooltip'>
                    <FormattedMessage
                        id='rhs_header.backToFlaggedTooltip'
                        defaultMessage='Back to saved posts'
                    />
                </Tooltip>
            );
            break;
        case RHSStates.PIN:
            backToResultsTooltip = (
                <Tooltip id='backToResultsTooltip'>
                    <FormattedMessage
                        id='rhs_header.backToPinnedTooltip'
                        defaultMessage='Back to pinned posts'
                    />
                </Tooltip>
            );
            break;
        }

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

        if (backToResultsTooltip) {
            back = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={backToResultsTooltip}
                >
                    <a
                        href='#'
                        onClick={this.handleBack}
                        className='sidebar--right__back'
                    >
                        <LocalizedIcon
                            className='icon icon-arrow-back-ios'
                            ariaLabel={{id: t('generic_icons.back'), defaultMessage: 'Back Icon'}}
                        />
                    </a>
                </OverlayTrigger>
            );
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {back}
                    <FormattedMessage
                        id='search_header.title5'
                        defaultMessage='Extra information'
                    />
                </span>
                <div className='pull-right'>
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='bottom'
                        overlay={this.props.isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn btn-icon btn-sm'
                            aria-label='Expand'
                            onClick={this.props.actions.toggleRhsExpanded}
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
                            type='button'
                            className='sidebar--right__close btn btn-icon btn-sm'
                            aria-label='Close'
                            onClick={this.props.actions.closeRightHandSide}
                        >
                            <LocalizedIcon
                                className='icon icon-close'
                                ariaLabel={{id: t('rhs_header.closeTooltip.icon'), defaultMessage: 'Close Sidebar Icon'}}
                            />
                        </button>
                    </OverlayTrigger>
                </div>
            </div>
        );
    }
}
