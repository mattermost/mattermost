// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import FollowButton from 'components/threading/common/follow_button';
import CRTThreadsPaneTutorialTip
    from 'components/tours/crt_tour/crt_threads_pane_tutorial_tip';
import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

type Props = WrappedComponentProps & {
    isExpanded: boolean;
    isMobileView: boolean;
    rootPostId: string;
    previousRhsState?: RhsState;
    relativeTeamUrl: string;
    channel: Channel;
    isCollapsedThreadsEnabled: boolean;
    isFollowingThread?: boolean;
    currentTeamId: string;
    showThreadsTutorialTip: boolean;
    currentUserId: string;
    setRhsExpanded: (b: boolean) => void;
    showMentions: () => void;
    showSearchResults: () => void;
    showFlaggedPosts: () => void;
    showPinnedPosts: () => void;
    goBack: () => void;
    closeRightHandSide: (e?: React.MouseEvent) => void;
    toggleRhsExpanded: (e: React.MouseEvent) => void;
    setThreadFollow: (userId: string, teamId: string, threadId: string, newState: boolean) => void;
};

class RhsHeaderPost extends React.PureComponent<Props> {
    handleBack = (e: React.MouseEvent) => {
        e.preventDefault();

        switch (this.props.previousRhsState) {
        case RHSStates.SEARCH:
        case RHSStates.MENTION:
        case RHSStates.FLAG:
        case RHSStates.PIN:
            this.props.goBack();
            break;
        default:
            break;
        }
    };

    handleJumpClick = () => {
        if (this.props.isMobileView) {
            this.props.closeRightHandSide();
        }

        this.props.setRhsExpanded(false);
        const teamUrl = this.props.relativeTeamUrl;
        getHistory().push(`${teamUrl}/pl/${this.props.rootPostId}`);
    };

    handleFollowChange = () => {
        const {currentTeamId, currentUserId, rootPostId, isFollowingThread} = this.props;
        this.props.setThreadFollow(currentUserId, currentTeamId, rootPostId, !isFollowingThread);
    };

    render() {
        let back;
        const {isFollowingThread} = this.props;
        const {formatMessage} = this.props.intl;
        const closeSidebarTooltip = (
            <FormattedMessage
                id='rhs_header.closeSidebarTooltip'
                defaultMessage='Close'
            />
        );

        let backToResultsTooltip;

        switch (this.props.previousRhsState) {
        case RHSStates.SEARCH:
        case RHSStates.MENTION:
            backToResultsTooltip = (
                <FormattedMessage
                    id='rhs_header.backToResultsTooltip'
                    defaultMessage='Back to search results'
                />
            );
            break;
        case RHSStates.FLAG:
            backToResultsTooltip = (
                <FormattedMessage
                    id='rhs_header.backToFlaggedTooltip'
                    defaultMessage='Back to saved messages'
                />
            );
            break;
        case RHSStates.PIN:
            backToResultsTooltip = (
                <FormattedMessage
                    id='rhs_header.backToPinnedTooltip'
                    defaultMessage='Back to pinned messages'
                />
            );
            break;
        }

        //rhsHeaderTooltipContent contains tooltips content for expand or shrink sidebarTooltip.
        // if props.isExpanded is true, defaultMessage would feed from 'shrinkTooltip', else 'expandTooltip'
        const rhsHeaderTooltipContent = this.props.isExpanded ? (
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

        const channelName = this.props.channel.display_name;

        if (backToResultsTooltip) {
            back = (
                <WithTooltip
                    id='backToResultsTooltip'
                    placement='top'
                    title={backToResultsTooltip}
                >
                    <button
                        className='sidebar--right__back btn btn-icon btn-sm'
                        onClick={this.handleBack}
                        aria-label={formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    >
                        <i
                            className='icon icon-arrow-back-ios'
                        />
                    </button>
                </WithTooltip>
            );
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {back}
                    <FormattedMessage
                        id='rhs_header.details'
                        defaultMessage='Thread'
                    />
                    {channelName &&
                        <button
                            onClick={this.handleJumpClick}
                            className='style--none sidebar--right__title__channel'
                        >
                            {channelName}
                        </button>
                    }
                </span>
                <div className='controls'>
                    {this.props.isCollapsedThreadsEnabled ? (
                        <FollowButton
                            className='sidebar--right__follow__thread'
                            isFollowing={isFollowingThread}
                            onClick={this.handleFollowChange}
                        />
                    ) : null}

                    <WithTooltip
                        id={this.props.isExpanded ? 'shrinkSidebarTooltip' : 'expandSidebarTooltip'}
                        placement='bottom'
                        title={rhsHeaderTooltipContent}
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn btn-icon btn-sm'
                            aria-label='Expand'
                            onClick={this.props.toggleRhsExpanded}
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
                    </WithTooltip>

                    <WithTooltip
                        id='closeSidebarTooltip'
                        placement='top'
                        title={closeSidebarTooltip}
                    >
                        <button
                            id='rhsCloseButton'
                            type='button'
                            className='sidebar--right__close btn btn-icon btn-sm'
                            aria-label='Close'
                            onClick={this.props.closeRightHandSide}
                        >
                            <i
                                className='icon icon-close'
                                aria-label={formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                            />
                        </button>
                    </WithTooltip>
                </div>
                {this.props.showThreadsTutorialTip && <CRTThreadsPaneTutorialTip/>}
            </div>
        );
    }
}

export default injectIntl(RhsHeaderPost);
