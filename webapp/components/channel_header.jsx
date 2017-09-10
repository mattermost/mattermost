// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import 'bootstrap';
import NavbarSearchBox from './search_bar.jsx';
import MessageWrapper from './message_wrapper.jsx';
import PopoverListMembers from 'components/popover_list_members';
import EditChannelHeaderModal from './edit_channel_header_modal.jsx';
import EditChannelPurposeModal from './edit_channel_purpose_modal.jsx';
import ChannelInfoModal from './channel_info_modal.jsx';
import ChannelInviteModal from 'components/channel_invite_modal';
import ChannelMembersModal from './channel_members_modal.jsx';
import ChannelNotificationsModal from './channel_notifications_modal.jsx';
import DeleteChannelModal from './delete_channel_modal.jsx';
import RenameChannelModal from './rename_channel_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import SearchStore from 'stores/search_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import * as WebrtcActions from 'actions/webrtc_actions.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import * as Utils from 'utils/utils.jsx';
import * as ChannelUtils from 'utils/channel_utils.jsx';
import {getSiteURL} from 'utils/url.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';
import {getFlaggedPosts, getPinnedPosts} from 'actions/post_actions.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import {Constants, Preferences, UserStatuses, ActionTypes} from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Tooltip, OverlayTrigger, Popover} from 'react-bootstrap';

const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

export default class ChannelHeader extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.searchMentions = this.searchMentions.bind(this);
        this.showRenameChannelModal = this.showRenameChannelModal.bind(this);
        this.hideRenameChannelModal = this.hideRenameChannelModal.bind(this);
        this.handleShortcut = this.handleShortcut.bind(this);
        this.getFlagged = this.getFlagged.bind(this);
        this.getPinnedPosts = this.getPinnedPosts.bind(this);
        this.initWebrtc = this.initWebrtc.bind(this);
        this.onBusy = this.onBusy.bind(this);
        this.openDirectMessageModal = this.openDirectMessageModal.bind(this);

        const state = this.getStateFromStores();
        state.showEditChannelHeaderModal = false;
        state.showEditChannelPurposeModal = false;
        state.showMembersModal = false;
        state.showRenameChannelModal = false;
        this.state = state;
    }

    getStateFromStores() {
        const channel = ChannelStore.get(this.props.channelId);
        const stats = ChannelStore.getStats(this.props.channelId);
        const users = UserStore.getProfileListInChannel(this.props.channelId, false, true);

        let otherUserId = null;
        if (channel && channel.type === 'D') {
            otherUserId = Utils.getUserIdFromChannelName(channel);
        }

        return {
            channel,
            memberChannel: ChannelStore.getMyMember(this.props.channelId),
            users,
            userCount: stats.member_count,
            currentUser: UserStore.getCurrentUser(),
            otherUserId,
            enableFormatting: PreferenceStore.getBool(Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', true),
            isBusy: WebrtcStore.isBusy(),
            isFavorite: channel && ChannelUtils.isFavoriteChannel(channel),
            pinsOpen: SearchStore.getIsPinnedPosts()
        };
    }

    validState() {
        if (!this.state.channel ||
            !this.state.memberChannel ||
            !this.state.users ||
            !this.state.userCount ||
            !this.state.currentUser) {
            return false;
        }
        return true;
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onListenerChange);
        ChannelStore.addStatsChangeListener(this.onListenerChange);
        SearchStore.addSearchChangeListener(this.onListenerChange);
        PreferenceStore.addChangeListener(this.onListenerChange);
        UserStore.addChangeListener(this.onListenerChange);
        UserStore.addInChannelChangeListener(this.onListenerChange);
        UserStore.addStatusesChangeListener(this.onListenerChange);
        WebrtcStore.addChangedListener(this.onListenerChange);
        WebrtcStore.addBusyListener(this.onBusy);
        $('.sidebar--left .dropdown-menu').perfectScrollbar();
        document.addEventListener('keydown', this.handleShortcut);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onListenerChange);
        ChannelStore.removeStatsChangeListener(this.onListenerChange);
        SearchStore.removeSearchChangeListener(this.onListenerChange);
        PreferenceStore.removeChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
        UserStore.removeInChannelChangeListener(this.onListenerChange);
        UserStore.removeStatusesChangeListener(this.onListenerChange);
        WebrtcStore.removeChangedListener(this.onListenerChange);
        WebrtcStore.removeBusyListener(this.onBusy);
        document.removeEventListener('keydown', this.handleShortcut);
    }

    shouldComponentUpdate(nextProps) {
        return Boolean(nextProps.channelId);
    }

    onListenerChange() {
        this.setState(this.getStateFromStores());
    }

    handleLeave() {
        if (this.state.channel.type === Constants.PRIVATE_CHANNEL) {
            GlobalActions.showLeavePrivateChannelModal(this.state.channel);
        } else {
            ChannelActions.leaveChannel(this.state.channel.id);
        }
    }

    toggleFavorite = (e) => {
        e.preventDefault();

        if (this.state.isFavorite) {
            ChannelActions.unmarkFavorite(this.state.channel.id);
        } else {
            ChannelActions.markFavorite(this.state.channel.id);
        }
    };

    searchMentions(e) {
        e.preventDefault();
        const user = this.state.currentUser;
        if (SearchStore.isMentionSearch) {
            // Close
            GlobalActions.toggleSideBarAction(false);
        } else {
            GlobalActions.emitSearchMentionsEvent(user);
        }
    }

    getPinnedPosts(e) {
        e.preventDefault();
        if (SearchStore.isPinnedPosts) {
            GlobalActions.toggleSideBarAction(false);
        } else {
            getPinnedPosts(this.props.channelId);
        }
    }

    getFlagged(e) {
        e.preventDefault();
        if (SearchStore.isFlaggedPosts) {
            GlobalActions.toggleSideBarAction(false);
        } else {
            getFlaggedPosts();
        }
    }

    handleShortcut(e) {
        if (Utils.cmdOrCtrlPressed(e) && e.shiftKey) {
            if (e.keyCode === Constants.KeyCodes.M) {
                e.preventDefault();
                this.searchMentions(e);
            }
        }
    }

    showRenameChannelModal(e) {
        e.preventDefault();

        this.setState({
            showRenameChannelModal: true
        });
    }

    hideRenameChannelModal() {
        this.setState({
            showRenameChannelModal: false
        });
    }

    initWebrtc(contactId, isOnline) {
        if (isOnline && !this.state.isBusy) {
            GlobalActions.emitCloseRightHandSide();
            WebrtcActions.initWebrtc(contactId, true);
        }
    }

    onBusy(isBusy) {
        this.setState({isBusy});
    }

    openDirectMessageModal() {
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_DM_MODAL,
            value: true,
            startingUsers: UserStore.getProfileListInChannel(this.props.channelId, true, false)
        });
    }

    render() {
        const flagIcon = Constants.FLAG_ICON_SVG;
        const pinIcon = Constants.PIN_ICON_SVG;
        const mentionsIcon = Constants.MENTIONS_ICON_SVG;

        if (!this.validState()) {
            // Use an empty div to make sure the header's height stays constant
            return (
                <div className='channel-header'/>
            );
        }

        const channel = this.state.channel;
        const recentMentionsTooltip = (
            <Tooltip id='recentMentionsTooltip'>
                <FormattedMessage
                    id='channel_header.recentMentions'
                    defaultMessage='Recent Mentions'
                />
            </Tooltip>
        );

        const pinnedPostTooltip = (
            <Tooltip id='pinnedPostTooltip'>
                <FormattedMessage
                    id='channel_header.pinnedPosts'
                    defaultMessage='Pinned Posts'
                />
            </Tooltip>
        );

        const flaggedTooltip = (
            <Tooltip
                id='flaggedTooltip'
                className='text-nowrap'
            >
                <FormattedMessage
                    id='channel_header.flagged'
                    defaultMessage='Flagged Posts'
                />
            </Tooltip>
        );

        const popoverContent = (
            <Popover
                id='header-popover'
                bStyle='info'
                bSize='large'
                placement='bottom'
                className='description'
                onMouseOver={() => this.refs.headerOverlay.show()}
                onMouseOut={() => this.refs.headerOverlay.hide()}
            >
                <MessageWrapper
                    message={channel.header}
                />
            </Popover>
        );
        let channelTitle = channel.display_name;
        const isChannelAdmin = ChannelStore.isChannelAdminForCurrentChannel();
        const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
        const isDirect = (this.state.channel.type === Constants.DM_CHANNEL);
        const isGroup = (this.state.channel.type === Constants.GM_CHANNEL);
        let webrtc;

        if (isDirect) {
            const userMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            const otherUserId = this.state.otherUserId;

            const teammateId = Utils.getUserIdFromChannelName(channel);
            channelTitle = Utils.displayUsername(teammateId);

            const webrtcEnabled = global.mm_config.EnableWebrtc === 'true' && userMedia && Utils.isFeatureEnabled(PreReleaseFeatures.WEBRTC_PREVIEW);

            if (webrtcEnabled) {
                const isOffline = UserStore.getStatus(otherUserId) === UserStatuses.OFFLINE;
                const busy = this.state.isBusy;
                let circleClass = '';
                let webrtcMessage;

                if (isOffline || busy) {
                    circleClass = 'offline';
                    webrtcMessage = (
                        <FormattedMessage
                            id='channel_header.webrtc.offline'
                            defaultMessage='The user is offline'
                        />
                    );

                    if (busy) {
                        webrtcMessage = (
                            <FormattedMessage
                                id='channel_header.webrtc.unavailable'
                                defaultMessage='New call unavailable until your existing call ends'
                            />
                        );
                    }
                } else {
                    webrtcMessage = (
                        <FormattedMessage
                            id='channel_header.webrtc.call'
                            defaultMessage='Start Video Call'
                        />
                    );
                }

                const webrtcTooltip = (
                    <Tooltip id='webrtcTooltip'>{webrtcMessage}</Tooltip>
                );

                webrtc = (
                    <div className='webrtc__header channel-header__icon'>
                        <a
                            href='#'
                            onClick={() => this.initWebrtc(otherUserId, !isOffline)}
                            disabled={isOffline}
                        >
                            <OverlayTrigger
                                trigger={['hover', 'focus']}
                                delayShow={Constants.WEBRTC_TIME_DELAY}
                                placement='bottom'
                                overlay={webrtcTooltip}
                            >
                                <div
                                    id='webrtc-btn'
                                    className={'webrtc__button ' + circleClass}
                                >
                                    <span dangerouslySetInnerHTML={{__html: Constants.VIDEO_ICON}}/>
                                </div>
                            </OverlayTrigger>
                        </a>
                    </div>
                );
            }
        }

        let popoverListMembers;
        if (!isDirect) {
            popoverListMembers = (
                <PopoverListMembers
                    channel={channel}
                    members={this.state.users}
                    memberCount={this.state.userCount}
                />
            );
        }

        const dropdownContents = [];
        if (isDirect) {
            dropdownContents.push(
                <li
                    key='edit_header_direct'
                    role='presentation'
                >
                    <ToggleModalButton
                        id='channelEditHeaderDirect'
                        role='menuitem'
                        dialogType={EditChannelHeaderModal}
                        dialogProps={{channel}}
                    >
                        <FormattedMessage
                            id='channel_header.channelHeader'
                            defaultMessage='Edit Channel Header'
                        />
                    </ToggleModalButton>
                </li>
            );
        } else if (isGroup) {
            dropdownContents.push(
                <li
                    key='edit_header_direct'
                    role='presentation'
                >
                    <ToggleModalButton
                        id='channelEditHeaderGroup'
                        role='menuitem'
                        dialogType={EditChannelHeaderModal}
                        dialogProps={{channel}}
                    >
                        <FormattedMessage
                            id='channel_header.channelHeader'
                            defaultMessage='Edit Channel Header'
                        />
                    </ToggleModalButton>
                </li>
            );

            dropdownContents.push(
                <li
                    key='notification_preferences'
                    role='presentation'
                >
                    <ToggleModalButton
                        id='channelnotificationPreferencesGroup'
                        role='menuitem'
                        dialogType={ChannelNotificationsModal}
                        dialogProps={{
                            channel,
                            channelMember: this.state.memberChannel,
                            currentUser: this.state.currentUser
                        }}
                    >
                        <FormattedMessage
                            id='channel_header.notificationPreferences'
                            defaultMessage='Notification Preferences'
                        />
                    </ToggleModalButton>
                </li>
            );

            dropdownContents.push(
                <li
                    key='add_members'
                    role='presentation'
                >
                    <a
                        id='channelAddMembersGroup'
                        role='menuitem'
                        href='#'
                        onClick={this.openDirectMessageModal}
                    >
                        <FormattedMessage
                            id='channel_header.addMembers'
                            defaultMessage='Add Members'
                        />
                    </a>
                </li>
            );
        } else {
            dropdownContents.push(
                <li
                    key='view_info'
                    role='presentation'
                >
                    <ToggleModalButton
                        id='channelViewInfo'
                        role='menuitem'
                        dialogType={ChannelInfoModal}
                        dialogProps={{channel}}
                    >
                        <FormattedMessage
                            id='channel_header.viewInfo'
                            defaultMessage='View Info'
                        />
                    </ToggleModalButton>
                </li>
            );

            if (ChannelStore.isDefault(channel)) {
                dropdownContents.push(
                    <li
                        key='manage_members'
                        role='presentation'
                    >
                        <a
                            id='channelManageMembers'
                            role='menuitem'
                            href='#'
                            onClick={() => this.setState({showMembersModal: true})}
                        >
                            <FormattedMessage
                                id='channel_header.viewMembers'
                                defaultMessage='View Members'
                            />
                        </a>
                    </li>
                );
            }

            dropdownContents.push(
                <li
                    key='notification_preferences'
                    role='presentation'
                >
                    <ToggleModalButton
                        id='channelNotificationPreferences'
                        role='menuitem'
                        dialogType={ChannelNotificationsModal}
                        dialogProps={{
                            channel,
                            channelMember: this.state.memberChannel,
                            currentUser: this.state.currentUser
                        }}
                    >
                        <FormattedMessage
                            id='channel_header.notificationPreferences'
                            defaultMessage='Notification Preferences'
                        />
                    </ToggleModalButton>
                </li>
            );

            if (!ChannelStore.isDefault(channel)) {
                dropdownContents.push(
                    <li
                        key='divider-1'
                        className='divider'
                    />
                );

                if (ChannelUtils.canManageMembers(channel, isChannelAdmin, isTeamAdmin, isSystemAdmin)) {
                    dropdownContents.push(
                        <li
                            key='add_members'
                            role='presentation'
                        >
                            <ToggleModalButton
                                id='channelAddMembers'
                                ref='channelInviteModalButton'
                                role='menuitem'
                                dialogType={ChannelInviteModal}
                                dialogProps={{channel, currentUser: this.state.currentUser}}
                            >
                                <FormattedMessage
                                    id='channel_header.addMembers'
                                    defaultMessage='Add Members'
                                />
                            </ToggleModalButton>
                        </li>
                    );

                    dropdownContents.push(
                        <li
                            key='manage_members'
                            role='presentation'
                        >
                            <a
                                id='channelManageMembers'
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showMembersModal: true})}
                            >
                                <FormattedMessage
                                    id='channel_header.manageMembers'
                                    defaultMessage='Manage Members'
                                />
                            </a>
                        </li>
                    );
                } else {
                    dropdownContents.push(
                        <li
                            key='view_members'
                            role='presentation'
                        >
                            <a
                                id='channelViewMembers'
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showMembersModal: true})}
                            >
                                <FormattedMessage
                                    id='channel_header.viewMembers'
                                    defaultMessage='View Members'
                                />
                            </a>
                        </li>
                    );
                }
            }

            if (ChannelUtils.showManagementOptions(channel, isChannelAdmin, isTeamAdmin, isSystemAdmin)) {
                dropdownContents.push(
                    <li
                        key='divider-2'
                        className='divider'
                    />
                );

                dropdownContents.push(
                    <li
                        key='set_channel_header'
                        role='presentation'
                    >
                        <ToggleModalButton
                            id='channelEditHeader'
                            role='menuitem'
                            dialogType={EditChannelHeaderModal}
                            dialogProps={{channel}}
                        >
                            <FormattedMessage
                                id='channel_header.setHeader'
                                defaultMessage='Edit Channel Header'
                            />
                        </ToggleModalButton>
                    </li>
                );

                dropdownContents.push(
                    <li
                        key='set_channel_purpose'
                        role='presentation'
                    >
                        <a
                            id='channelEditPurpose'
                            role='menuitem'
                            href='#'
                            onClick={() => this.setState({showEditChannelPurposeModal: true})}
                        >
                            <FormattedMessage
                                id='channel_header.setPurpose'
                                defaultMessage='Edit Channel Purpose'
                            />
                        </a>
                    </li>
                );

                dropdownContents.push(
                    <li
                        key='rename_channel'
                        role='presentation'
                    >
                        <a
                            id='channelRename'
                            role='menuitem'
                            href='#'
                            onClick={this.showRenameChannelModal}
                        >
                            <FormattedMessage
                                id='channel_header.rename'
                                defaultMessage='Rename Channel'
                            />
                        </a>
                    </li>
                );
            }

            if (ChannelUtils.showDeleteOptionForCurrentUser(channel, isChannelAdmin, isTeamAdmin, isSystemAdmin)) {
                dropdownContents.push(
                    <li
                        key='delete_channel'
                        role='presentation'
                    >
                        <ToggleModalButton
                            id='channelDelete'
                            role='menuitem'
                            dialogType={DeleteChannelModal}
                            dialogProps={{channel}}
                        >
                            <FormattedMessage
                                id='channel_header.delete'
                                defaultMessage='Delete Channel'
                            />
                        </ToggleModalButton>
                    </li>
                );
            }

            if (!ChannelStore.isDefault(channel)) {
                dropdownContents.push(
                    <li
                        key='divider-3'
                        className='divider'
                    />
                );

                dropdownContents.push(
                    <li
                        key='leave_channel'
                        role='presentation'
                    >
                        <a
                            id='channelLeave'
                            role='menuitem'
                            href='#'
                            onClick={this.handleLeave}
                        >
                            <FormattedMessage
                                id='channel_header.leave'
                                defaultMessage='Leave Channel'
                            />
                        </a>
                    </li>
                );
            }
        }

        let headerTextContainer;
        if (channel.header) {
            let headerTextElement;
            if (this.state.enableFormatting) {
                headerTextElement = (
                    <div
                        onClick={Utils.handleFormattedTextClick}
                        className='channel-header__description'
                        dangerouslySetInnerHTML={{__html: TextFormatting.formatText(channel.header, {singleline: true, mentionHighlight: false, siteURL: getSiteURL()})}}
                    />
                );
            } else {
                headerTextElement = (
                    <div
                        onClick={Utils.handleFormattedTextClick}
                        className='channel-header__description'
                    >
                        {channel.header}
                    </div>
                );
            }

            headerTextContainer = (
                <OverlayTrigger
                    trigger={'click'}
                    placement='bottom'
                    rootClose={true}
                    overlay={popoverContent}
                    ref='headerOverlay'
                >
                    {headerTextElement}
                </OverlayTrigger>
            );
        } else {
            headerTextContainer = (
                <a
                    href='#'
                    className='channel-header__description light'
                    onClick={() => this.setState({showEditChannelHeaderModal: true})}
                >
                    <FormattedMessage
                        id='channel_header.addChannelHeader'
                        defaultMessage='Add a channel description'
                    />
                </a>
            );
        }

        let editHeaderModal;
        if (this.state.showEditChannelHeaderModal) {
            editHeaderModal = (
                <EditChannelHeaderModal
                    onHide={() => this.setState({showEditChannelHeaderModal: false})}
                    channel={channel}
                />
            );
        }

        let toggleFavoriteTooltip;
        if (this.state.isFavorite) {
            toggleFavoriteTooltip = (
                <Tooltip id='favoriteTooltip'>
                    <FormattedMessage
                        id='channelHeader.removeFromFavorites'
                        defaultMessage='Remove from Favorites'
                    />
                </Tooltip>
            );
        } else {
            toggleFavoriteTooltip = (
                <Tooltip id='favoriteTooltip'>
                    <FormattedMessage
                        id='channelHeader.addToFavorites'
                        defaultMessage='Add to Favorites'
                    />
                </Tooltip>
            );
        }

        const toggleFavorite = (
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='bottom'
                overlay={toggleFavoriteTooltip}
            >
                <a
                    id='toggleFavorite'
                    href='#'
                    onClick={this.toggleFavorite}
                    className={'channel-header__favorites ' + (this.state.isFavorite ? 'active' : 'inactive')}
                >
                    <i className={'icon fa ' + (this.state.isFavorite ? 'fa-star' : 'fa-star-o')}/>
                </a>
            </OverlayTrigger>
        );

        let channelMembersModal;
        if (this.state.showMembersModal) {
            channelMembersModal = (
                <ChannelMembersModal
                    onModalDismissed={() => this.setState({showMembersModal: false})}
                    showInviteModal={() => this.refs.channelInviteModalButton.show()}
                    channel={channel}
                />
            );
        }

        let editPurposeModal;
        if (this.state.showEditChannelPurposeModal) {
            editPurposeModal = (
                <EditChannelPurposeModal
                    onModalDismissed={() => this.setState({showEditChannelPurposeModal: false})}
                    channel={channel}
                />
            );
        }

        let pinnedIconClass = 'channel-header__icon';
        if (this.state.pinsOpen) {
            pinnedIconClass += ' active';
        }

        return (
            <div
                id='channel-header'
                className='channel-header alt'
            >
                <div className='flex-parent'>
                    <div className='flex-child'>
                        <div className='channel-header__info'>
                            {toggleFavorite}
                            <div className='channel-header__title dropdown'>
                                <a
                                    id='channelHeaderDropdown'
                                    href='#'
                                    className='dropdown-toggle theme'
                                    type='button'
                                    data-toggle='dropdown'
                                    aria-expanded='true'
                                >
                                    <strong className='heading'>{channelTitle} </strong>
                                    <span className='fa fa-angle-down header-dropdown__icon'/>
                                </a>
                                <ul
                                    className='dropdown-menu'
                                    role='menu'
                                    aria-labelledby='channel_header_dropdown'
                                >
                                    {dropdownContents}
                                </ul>
                            </div>
                            {headerTextContainer}
                        </div>
                    </div>
                    <div className='flex-child'>
                        {webrtc}
                    </div>
                    <div className='flex-child'>
                        {popoverListMembers}
                    </div>
                    <div className='flex-child'>
                        <OverlayTrigger
                            trigger={['hover', 'focus']}
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='bottom'
                            overlay={pinnedPostTooltip}
                        >
                            <div
                                className={pinnedIconClass}
                                onClick={this.getPinnedPosts}
                            >
                                <span
                                    className='icon icon__pin'
                                    dangerouslySetInnerHTML={{__html: pinIcon}}
                                    aria-hidden='true'
                                />
                            </div>
                        </OverlayTrigger>
                    </div>
                    <div className='flex-child search-bar__container'>
                        <NavbarSearchBox
                            showMentionFlagBtns={false}
                            isFocus={Utils.isMobile()}
                        />
                    </div>
                    <div className='flex-child'>
                        <OverlayTrigger
                            trigger={['hover', 'focus']}
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='bottom'
                            overlay={recentMentionsTooltip}
                        >
                            <div
                                className='channel-header__icon icon--hidden'
                                onClick={this.searchMentions}
                            >
                                <span
                                    className='icon icon__mentions'
                                    dangerouslySetInnerHTML={{__html: mentionsIcon}}
                                    aria-hidden='true'
                                />
                            </div>
                        </OverlayTrigger>
                    </div>
                    <div className='flex-child'>
                        <OverlayTrigger
                            trigger={['hover', 'focus']}
                            delayShow={Constants.OVERLAY_TIME_DELAY}
                            placement='bottom'
                            overlay={flaggedTooltip}
                        >
                            <div
                                className='channel-header__icon icon--hidden'
                                onClick={this.getFlagged}

                            >
                                <span
                                    className='icon icon__flag'
                                    dangerouslySetInnerHTML={{__html: flagIcon}}
                                />
                            </div>
                        </OverlayTrigger>
                    </div>
                </div>
                {editHeaderModal}
                {editPurposeModal}
                {channelMembersModal}
                <RenameChannelModal
                    show={this.state.showRenameChannelModal}
                    onHide={this.hideRenameChannelModal}
                    channel={channel}
                />
            </div>
        );
    }
}

ChannelHeader.propTypes = {
    channelId: PropTypes.string.isRequired
};
