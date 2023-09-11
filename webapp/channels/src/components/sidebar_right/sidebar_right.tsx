// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ProductIdentifier} from '@mattermost/types/products';
import type {Team} from '@mattermost/types/teams';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import ChannelInfoRhs from 'components/channel_info_rhs';
import ChannelMembersRhs from 'components/channel_members_rhs';
import FileUploadOverlay from 'components/file_upload_overlay';
import LoadingScreen from 'components/loading_screen';
import PostEditHistory from 'components/post_edit_history';
import ResizableRhs from 'components/resizable_sidebar/resizable_rhs';
import RhsCard from 'components/rhs_card';
import RhsThread from 'components/rhs_thread';
import Search from 'components/search/index';

import RhsPlugin from 'plugins/rhs_plugin';
import Constants from 'utils/constants';
import {cmdOrCtrlPressed, isKeyPressed} from 'utils/keyboard';
import {isMac} from 'utils/user_agent';

import type {RhsState} from 'types/store/rhs';

export type Props = {
    isExpanded: boolean;
    isOpen: boolean;
    channel: Channel;
    team: Team;
    teamId: Team['id'];
    productId: ProductIdentifier;
    postRightVisible: boolean;
    postCardVisible: boolean;
    searchVisible: boolean;
    isPinnedPosts: boolean;
    isChannelFiles: boolean;
    isChannelInfo: boolean;
    isChannelMembers: boolean;
    isPluginView: boolean;
    isPostEditHistory: boolean;
    previousRhsState: RhsState;
    rhsChannel: Channel;
    selectedPostId: string;
    selectedPostCardId: string;
    actions: {
        setRhsExpanded: (expanded: boolean) => void;
        showPinnedPosts: (channelId: string) => void;
        openRHSSearch: () => void;
        closeRightHandSide: () => void;
        openAtPrevious: (previous: Partial<Props> | undefined) => void;
        updateSearchTerms: (terms: string) => void;
        showChannelFiles: (channelId: string) => void;
        showChannelInfo: (channelId: string) => void;
    };
}

type State = {
    isOpened: boolean;
}

export default class SidebarRight extends React.PureComponent<Props, State> {
    sidebarRight: React.RefObject<HTMLDivElement>;
    sidebarRightWidthHolder: React.RefObject<HTMLDivElement>;
    previous: Partial<Props> | undefined = undefined;
    focusSearchBar?: () => void;

    constructor(props: Props) {
        super(props);

        this.sidebarRightWidthHolder = React.createRef<HTMLDivElement>();
        this.sidebarRight = React.createRef<HTMLDivElement>();
        this.state = {
            isOpened: false,
        };
    }

    setPrevious = () => {
        if (!this.props.isOpen) {
            return;
        }

        this.previous = {
            searchVisible: this.props.searchVisible,
            isPinnedPosts: this.props.isPinnedPosts,
            isChannelFiles: this.props.isChannelFiles,
            isChannelInfo: this.props.isChannelInfo,
            isChannelMembers: this.props.isChannelMembers,
            isPostEditHistory: this.props.isPostEditHistory,
            selectedPostId: this.props.selectedPostId,
            selectedPostCardId: this.props.selectedPostCardId,
            previousRhsState: this.props.previousRhsState,
        };
    };

    handleShortcut = (e: KeyboardEvent) => {
        const channelInfoShortcutMac = isMac() && e.shiftKey;
        const channelInfoShortcut = !isMac() && e.altKey;

        if (cmdOrCtrlPressed(e, true)) {
            if (e.shiftKey && isKeyPressed(e, Constants.KeyCodes.PERIOD)) {
                e.preventDefault();
                if (this.props.isOpen) {
                    if (this.props.isExpanded) {
                        this.props.actions.setRhsExpanded(false);
                    } else {
                        this.props.actions.setRhsExpanded(true);
                    }
                } else {
                    this.props.actions.openAtPrevious(this.previous);
                }
            } else if (isKeyPressed(e, Constants.KeyCodes.PERIOD)) {
                e.preventDefault();
                if (this.props.isOpen) {
                    this.props.actions.closeRightHandSide();
                } else {
                    this.props.actions.openAtPrevious(this.previous);
                }
            } else if (isKeyPressed(e, Constants.KeyCodes.I) && (channelInfoShortcutMac || channelInfoShortcut)) {
                e.preventDefault();
                if (this.props.isOpen && this.props.isChannelInfo) {
                    this.props.actions.closeRightHandSide();
                } else if (this.props.channel) {
                    this.props.actions.showChannelInfo(this.props.channel.id);
                }
            }
        }
    };

    componentDidMount() {
        document.addEventListener('keydown', this.handleShortcut);
        document.addEventListener('mousedown', this.handleClickOutside);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleShortcut);
        document.removeEventListener('mousedown', this.handleClickOutside);
    }

    componentDidUpdate(prevProps: Props) {
        const wasOpen = prevProps.searchVisible || prevProps.postRightVisible;
        const isOpen = this.props.searchVisible || this.props.postRightVisible;

        if (!wasOpen && isOpen) {
            trackEvent('ui', 'ui_rhs_opened');
        }

        const {actions, isChannelFiles, isPinnedPosts, rhsChannel, channel} = this.props;
        if (isPinnedPosts && prevProps.isPinnedPosts === isPinnedPosts && rhsChannel.id !== prevProps.rhsChannel.id) {
            actions.showPinnedPosts(rhsChannel.id);
        }

        if (isChannelFiles && prevProps.isChannelFiles === isChannelFiles && rhsChannel.id !== prevProps.rhsChannel.id) {
            actions.showChannelFiles(rhsChannel.id);
        }

        // in the case of navigating to another channel
        // or from global threads to a channel
        // we shrink the sidebar
        if (
            (channel && prevProps.channel && (channel.id !== prevProps.channel.id)) ||
            (channel && !prevProps.channel)
        ) {
            this.props.actions.setRhsExpanded(false);
        }

        // close when changing products or teams
        if (
            (prevProps.teamId && this.props.teamId !== prevProps.teamId) ||
            this.props.productId !== prevProps.productId
        ) {
            this.props.actions.closeRightHandSide();
        }

        this.setPrevious();
    }

    handleClickOutside = (e: MouseEvent) => {
        if (
            (this.props.isOpen && this.props.isExpanded) && // can be collapsed
            e.target && // has target
            document.getElementById('root')?.contains(e.target as Element) &&//  within Root
            !this.sidebarRight.current?.contains(e.target as Element) && // not within RHS
            !document.getElementById('global-header')?.contains(e.target as Element) && // not within Global Header
            !document.querySelector('.app-bar')?.contains(e.target as Element) // not within App Bar
        ) {
            this.props.actions.setRhsExpanded(false);
        }
    };

    handleUpdateSearchTerms = (term: string) => {
        this.props.actions.updateSearchTerms(term);
        this.focusSearchBar?.();
    };

    getSearchBarFocus = (focusSearchBar: () => void) => {
        this.focusSearchBar = focusSearchBar;
    };

    render() {
        const {
            team,
            channel,
            rhsChannel,
            postRightVisible,
            postCardVisible,
            previousRhsState,
            searchVisible,
            isPluginView,
            isOpen,
            isChannelInfo,
            isChannelMembers,
            isExpanded,
            isPostEditHistory,
        } = this.props;

        if (!isOpen) {
            return null;
        }

        const teamNeeded = true;
        let selectedChannelNeeded;
        let currentChannelNeeded;
        let content = null;

        if (postRightVisible) {
            selectedChannelNeeded = true;
            content = (
                <div className='post-right__container'>
                    <FileUploadOverlay overlayType='right'/>
                    <RhsThread previousRhsState={previousRhsState}/>
                </div>
            );
        } else if (postCardVisible) {
            content = <RhsCard previousRhsState={previousRhsState}/>;
        } else if (isPluginView) {
            content = <RhsPlugin/>;
        } else if (isChannelInfo) {
            currentChannelNeeded = true;
            content = <ChannelInfoRhs/>;
        } else if (isChannelMembers) {
            currentChannelNeeded = true;
            content = <ChannelMembersRhs/>;
        } else if (isPostEditHistory) {
            content = <PostEditHistory/>;
        }

        const isRHSLoading = Boolean(
            (teamNeeded && !team) ||
            (selectedChannelNeeded && !rhsChannel) ||
            (currentChannelNeeded && !channel),
        );

        const channelDisplayName = rhsChannel ? rhsChannel.display_name : '';

        const isSidebarRightExpanded = (postRightVisible || postCardVisible || isPluginView || searchVisible || isPostEditHistory) && isExpanded;
        const containerClassName = classNames('sidebar--right', 'move--left is-open', {
            'sidebar--right--expanded expanded': isSidebarRightExpanded,
        });

        return (
            <>
                <div
                    className={'sidebar--right sidebar--right--width-holder'}
                    ref={this.sidebarRightWidthHolder}
                />
                <ResizableRhs
                    className={containerClassName}
                    id='sidebar-right'
                    role='complementary'
                    rightWidthHolderRef={this.sidebarRightWidthHolder}
                >
                    <div
                        className='sidebar-right-container'
                        ref={this.sidebarRight}
                    >
                        {isRHSLoading ? (
                            <div className='sidebar-right__body'>
                                {/* Sometimes the channel/team is not loaded yet, so we need to wait for it */}
                                <LoadingScreen centered={true}/>
                            </div>
                        ) : (
                            <Search
                                isSideBarRight={true}
                                isSideBarRightOpen={true}
                                getFocus={this.getSearchBarFocus}
                                channelDisplayName={channelDisplayName}
                            >
                                {content}
                            </Search>
                        )}
                    </div>
                </ResizableRhs>
            </>
        );
    }
}
