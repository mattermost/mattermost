// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import LocalizedIcon from 'components/localized_icon';
import OverlayTrigger from 'components/overlay_trigger';
import FollowButton from 'components/threading/common/follow_button';
import Tooltip from 'components/tooltip';
import CRTThreadsPaneTutorialTip
    from 'components/tours/crt_tour/crt_threads_pane_tutorial_tip';

import {getHistory} from 'utils/browser_history';
import Constants, {RHSStates} from 'utils/constants';
import {t} from 'utils/i18n';

import type {Channel} from '@mattermost/types/channels';
import type {RhsState} from 'types/store/rhs';

interface RhsHeaderPostProps {
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
}

export default class RhsHeaderPost extends React.PureComponent<RhsHeaderPostProps> {
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
        const closeSidebarTooltip = (
            <Tooltip id='closeSidebarTooltip'>
                <FormattedMessage
                    id='rhs_header.closeSidebarTooltip'
                    defaultMessage='Close'
                />
            </Tooltip>
        );

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

        const channelName = this.props.channel.display_name;

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

                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='bottom'
                        overlay={this.props.isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn-icon'
                            aria-label='Expand'
                            onClick={this.props.toggleRhsExpanded}
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
                            onClick={this.props.closeRightHandSide}
                        >
                            <LocalizedIcon
                                className='icon icon-close'
                                ariaLabel={{id: t('rhs_header.closeTooltip.icon'), defaultMessage: 'Close Sidebar Icon'}}
                            />
                        </button>
                    </OverlayTrigger>
                </div>
                {this.props.showThreadsTutorialTip && <CRTThreadsPaneTutorialTip/>}
            </div>
        );
    }
}
