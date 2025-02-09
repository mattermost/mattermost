// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, type IntlShape} from 'react-intl';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

type Props = {
    intl: IntlShape;
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

class RhsCardHeader extends React.PureComponent<Props> {
    handleBack = (e: React.MouseEvent<HTMLButtonElement>): void => {
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
        let title;

        switch (this.props.previousRhsState) {
        case RHSStates.SEARCH:
        case RHSStates.MENTION:
            title = (
                <FormattedMessage
                    id='rhs_header.backToResultsTooltip'
                    defaultMessage='Back to search results'
                />
            );
            break;
        case RHSStates.FLAG:
            title = (
                <FormattedMessage
                    id='rhs_header.backToFlaggedTooltip'
                    defaultMessage='Back to saved messages'
                />
            );
            break;
        case RHSStates.PIN:
            title = (
                <FormattedMessage
                    id='rhs_header.backToPinnedTooltip'
                    defaultMessage='Back to pinned messages'
                />
            );
            break;
        }

        const expandSidebarTooltip = (
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

        const shrinkSidebarTooltip = (
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

        if (title) {
            back = (
                <WithTooltip
                    title={title}
                >
                    <button
                        className='sidebar--right__back btn btn-icon btn-sm'
                        onClick={this.handleBack}
                        aria-label={this.props.intl.formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    >
                        <i
                            className='icon icon-arrow-back-ios'
                        />
                    </button>
                </WithTooltip>
            );
        }

        const collapseIconLabel = this.props.intl.formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse Sidebar Icon'});
        const expandIconLabel = this.props.intl.formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand Sidebar Icon'});

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
                    <WithTooltip
                        title={this.props.isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn btn-icon btn-sm'
                            aria-label={this.props.isExpanded ? collapseIconLabel : expandIconLabel}
                            onClick={this.props.actions.toggleRhsExpanded}
                        >
                            <i
                                className='icon icon-arrow-expand'
                            />
                            <i
                                className='icon icon-arrow-collapse'
                            />
                        </button>
                    </WithTooltip>
                    <WithTooltip
                        title={
                            <FormattedMessage
                                id='rhs_header.closeSidebarTooltip'
                                defaultMessage='Close'
                            />
                        }
                    >
                        <button
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
                    </WithTooltip>
                </div>
            </div>
        );
    }
}

export default injectIntl(RhsCardHeader);
