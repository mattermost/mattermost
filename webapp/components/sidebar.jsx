// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import NewChannelFlow from './new_channel_flow.jsx';
import MoreDirectChannels from 'components/more_direct_channels';
import MoreChannels from 'components/more_channels';
import SidebarHeader from './sidebar_header.jsx';
import UnreadChannelIndicator from './unread_channel_indicator.jsx';
import TutorialTip from './tutorial/tutorial_tip.jsx';
import StatusIcon from './status_icon.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import ModalStore from 'stores/modal_store.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import * as Utils from 'utils/utils.jsx';
import * as ChannelUtils from 'utils/channel_utils.jsx';
import * as ChannelActions from 'actions/channel_actions.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';

import {trackEvent} from 'actions/diagnostics_actions.jsx';
import {ActionTypes, Constants} from 'utils/constants.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;

import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import loadingGif from 'images/load.gif';

import React from 'react';
import {browserHistory, Link} from 'react-router/es6';

import favicon from 'images/favicon/favicon-16x16.png';
import redFavicon from 'images/favicon/redfavicon-16x16.png';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {getChannelsByCategory} from 'mattermost-redux/selectors/entities/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';

export default class Sidebar extends React.Component {
    constructor(props) {
        super(props);

        this.badgesActive = false;
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        this.isLeaving = new Map();
        this.isSwitchingChannel = false;
        this.closedDirectChannel = false;

        const state = this.getStateFromStores();
        state.newChannelModalType = '';
        state.showDirectChannelsModal = false;
        state.showMoreChannelsModal = false;
        state.loadingDMChannel = -1;
        state.inChannelChange = false;
        this.state = state;
    }

    getTotalUnreadCount = () => {
        const unreads = ChannelUtils.getCountsStateFromStores(this.state.currentTeam, this.state.teamMembers, this.state.unreadCounts);
        return {msgs: unreads.messageCount, mentions: unreads.mentionCount};
    }

    getStateFromStores = () => {
        const members = ChannelStore.getMyMembers();
        const teamMembers = TeamStore.getMyTeamMembers();
        const currentChannelId = ChannelStore.getCurrentId();
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);

        const displayableChannels = getChannelsByCategory(store.getState());

        return {
            activeId: currentChannelId,
            members,
            teamMembers,
            ...displayableChannels,
            unreadCounts: JSON.parse(JSON.stringify(ChannelStore.getUnreadCounts())),
            showTutorialTip: tutorialStep === TutorialSteps.CHANNEL_POPOVER,
            currentTeam: TeamStore.getCurrent(),
            currentUser: UserStore.getCurrentUser(),
            townSquare: ChannelStore.getByName(Constants.DEFAULT_CHANNEL),
            offTopic: ChannelStore.getByName(Constants.OFFTOPIC_CHANNEL)
        };
    }

    onInChannelChange = () => {
        this.setState({inChannelChange: !this.state.inChannelChange});
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addChangeListener(this.onChange);
        UserStore.addInTeamChangeListener(this.onChange);
        UserStore.addInChannelChangeListener(this.onInChannelChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onChange);
        ModalStore.addModalListener(ActionTypes.TOGGLE_DM_MODAL, this.onModalChange);

        this.updateTitle();
        this.updateUnreadIndicators();

        document.addEventListener('keydown', this.navigateChannelShortcut);
        document.addEventListener('keydown', this.navigateUnreadChannelShortcut);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState, this.state)) {
            return true;
        }
        return false;
    }

    componentDidUpdate(prevProps, prevState) {
        this.updateTitle();
        this.updateUnreadIndicators();
        if (!Utils.isMobile()) {
            $('.sidebar--left .nav-pills__container').perfectScrollbar();
        }

        // reset the scrollbar upon switching teams
        if (this.state.currentTeam !== prevState.currentTeam) {
            this.refs.container.scrollTop = 0;
            $('.nav-pills__container').perfectScrollbar('update');
        }

        // close the LHS on mobile when you change channels
        if (this.state.activeId !== prevState.activeId) {
            if (this.closedDirectChannel) {
                this.closedDirectChannel = false;
            } else {
                $('.app__body .inner-wrap').removeClass('move--right');
                $('.app__body .sidebar--left').removeClass('move--right');
                $('.multi-teams .team-sidebar').removeClass('move--right');
            }
        }
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeInTeamChangeListener(this.onChange);
        UserStore.removeInChannelChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onChange);
        ModalStore.removeModalListener(ActionTypes.TOGGLE_DM_MODAL, this.onModalChange);
        document.removeEventListener('keydown', this.navigateChannelShortcut);
        document.removeEventListener('keydown', this.navigateUnreadChannelShortcut);
    }

    onModalChange = (value, args) => {
        this.showMoreDirectChannelsModal(args.startingUsers);
    }

    handleOpenMoreDirectChannelsModal = (e) => {
        e.preventDefault();
        if (this.state.showDirectChannelsModal) {
            this.hideMoreDirectChannelsModal();
        } else {
            this.showMoreDirectChannelsModal();
        }
    }

    onChange = () => {
        if (this.state.currentTeam.id !== TeamStore.getCurrentId()) {
            ChannelStore.clear();
        }
        this.setState(this.getStateFromStores());
        this.updateTitle();
    }

    updateTitle = () => {
        const channel = ChannelStore.getCurrent();
        if (channel && this.state.currentTeam) {
            let currentSiteName = '';
            if (global.window.mm_config.SiteName != null) {
                currentSiteName = global.window.mm_config.SiteName;
            }

            let currentChannelName = channel.display_name;
            if (channel.type === Constants.DM_CHANNEL) {
                const teammate = Utils.getDirectTeammate(channel.id);
                if (teammate != null) {
                    currentChannelName = teammate.username;
                }
            }

            const unread = this.getTotalUnreadCount();
            const mentionTitle = unread.mentions > 0 ? '(' + unread.mentions + ') ' : '';
            const unreadTitle = unread.msgs > 0 ? '* ' : '';
            document.title = mentionTitle + unreadTitle + currentChannelName + ' - ' + this.state.currentTeam.display_name + ' ' + currentSiteName;
        }
    }

    onScroll = () => {
        this.updateUnreadIndicators();
    }

    updateUnreadIndicators = () => {
        const container = $(ReactDOM.findDOMNode(this.refs.container));

        var showTopUnread = false;
        var showBottomUnread = false;

        // Consider partially obscured channels as above/below
        const unreadMargin = 15;

        if (this.firstUnreadChannel) {
            var firstUnreadElement = $(ReactDOM.findDOMNode(this.refs[this.firstUnreadChannel]));

            if (firstUnreadElement.position().top + firstUnreadElement.height() < unreadMargin) {
                showTopUnread = true;
            }
        }

        if (this.lastUnreadChannel) {
            var lastUnreadElement = $(ReactDOM.findDOMNode(this.refs[this.lastUnreadChannel]));

            if (lastUnreadElement.position().top > container.height() - unreadMargin) {
                showBottomUnread = true;
            }
        }

        this.setState({
            showTopUnread,
            showBottomUnread
        });
    }

    updateScrollbarOnChannelChange = (channel) => {
        const curChannel = this.refs[channel.name].getBoundingClientRect();
        if ((curChannel.top - Constants.CHANNEL_SCROLL_ADJUSTMENT < 0) || (curChannel.top + curChannel.height > this.refs.container.getBoundingClientRect().height)) {
            this.refs.container.scrollTop = this.refs.container.scrollTop + (curChannel.top - Constants.CHANNEL_SCROLL_ADJUSTMENT);
            $('.nav-pills__container').perfectScrollbar('update');
        }
    }

    navigateChannelShortcut = (e) => {
        if (e.altKey && !e.shiftKey && (e.keyCode === Constants.KeyCodes.UP || e.keyCode === Constants.KeyCodes.DOWN)) {
            e.preventDefault();

            if (this.isSwitchingChannel) {
                return;
            }

            this.isSwitchingChannel = true;
            const allChannels = this.getDisplayedChannels();
            const curChannelId = this.state.activeId;
            let curIndex = -1;
            for (let i = 0; i < allChannels.length; i++) {
                if (allChannels[i].id === curChannelId) {
                    curIndex = i;
                }
            }
            let nextIndex = curIndex;
            if (e.keyCode === Constants.KeyCodes.DOWN) {
                nextIndex = curIndex + 1;
            } else if (e.keyCode === Constants.KeyCodes.UP) {
                nextIndex = curIndex - 1;
            }
            const nextChannel = allChannels[Utils.mod(nextIndex, allChannels.length)];
            ChannelActions.goToChannel(nextChannel);
            this.updateScrollbarOnChannelChange(nextChannel);
            this.isSwitchingChannel = false;
        } else if (Utils.cmdOrCtrlPressed(e) && e.shiftKey && e.keyCode === Constants.KeyCodes.K) {
            this.handleOpenMoreDirectChannelsModal(e);
        }
    }

    navigateUnreadChannelShortcut = (e) => {
        if (e.altKey && e.shiftKey && (e.keyCode === Constants.KeyCodes.UP || e.keyCode === Constants.KeyCodes.DOWN)) {
            e.preventDefault();

            if (this.isSwitchingChannel) {
                return;
            }

            this.isSwitchingChannel = true;
            const allChannels = this.getDisplayedChannels();
            const curChannelId = this.state.activeId;
            let curIndex = -1;
            for (let i = 0; i < allChannels.length; i++) {
                if (allChannels[i].id === curChannelId) {
                    curIndex = i;
                }
            }
            let nextIndex = curIndex;
            let count = 0;
            let increment = 0;
            if (e.keyCode === Constants.KeyCodes.UP) {
                increment = -1;
            } else if (e.keyCode === Constants.KeyCodes.DOWN) {
                increment = 1;
            }
            let unreadCounts = ChannelStore.getUnreadCount(allChannels[nextIndex].id);
            while (count < allChannels.length && unreadCounts.msgs === 0 && unreadCounts.mentions === 0) {
                nextIndex += increment;
                count++;
                nextIndex = Utils.mod(nextIndex, allChannels.length);
                unreadCounts = ChannelStore.getUnreadCount(allChannels[nextIndex].id);
            }
            if (unreadCounts.msgs !== 0 || unreadCounts.mentions !== 0) {
                const nextChannel = allChannels[nextIndex];
                ChannelActions.goToChannel(nextChannel);
                this.updateScrollbarOnChannelChange(nextChannel);
            }
            this.isSwitchingChannel = false;
        }
    }

    getDisplayedChannels = () => {
        return this.state.favoriteChannels.concat(this.state.publicChannels).concat(this.state.privateChannels).concat(this.state.directAndGroupChannels);
    }

    handleLeavePublicChannel = (e, channel) => {
        e.preventDefault();
        ChannelActions.leaveChannel(channel.id);
        trackEvent('ui', 'ui_public_channel_x_button_clicked');
    }

    handleLeavePrivateChannel = (e, channel) => {
        e.preventDefault();
        GlobalActions.showLeavePrivateChannelModal(channel);
        trackEvent('ui', 'ui_private_channel_x_button_clicked');
    }

    handleLeaveDirectChannel = (e, channel) => {
        e.preventDefault();

        if (!this.isLeaving.get(channel.id)) {
            this.isLeaving.set(channel.id, true);

            let id;
            let category;
            if (channel.type === Constants.DM_CHANNEL) {
                id = channel.teammate_id;
                category = Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;
            } else {
                id = channel.id;
                category = Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW;
            }

            const currentUserId = UserStore.getCurrentId();
            savePreferences(currentUserId, [{user_id: currentUserId, category, name: id, value: 'false'}])(dispatch, getState).then(
                () => {
                    this.isLeaving.set(channel.id, false);
                }
            );

            if (ChannelUtils.isFavoriteChannel(channel)) {
                ChannelActions.unmarkFavorite(channel.id);
            }

            this.setState(this.getStateFromStores());
            trackEvent('ui', 'ui_direct_channel_x_button_clicked');
        }

        if (channel.id === this.state.activeId) {
            this.closedDirectChannel = true;
            browserHistory.push('/' + this.state.currentTeam.name + '/channels/town-square');
        }
    }

    showMoreChannelsModal = () => {
        this.setState({showMoreChannelsModal: true});
        trackEvent('ui', 'ui_channels_more_public');
    }

    hideMoreChannelsModal = () => {
        this.setState({showMoreChannelsModal: false});
    }

    showNewChannelModal = (type) => {
        this.setState({newChannelModalType: type});
    }

    hideNewChannelModal = () => {
        this.setState({newChannelModalType: ''});
    }

    showMoreDirectChannelsModal = (startingUsers) => {
        trackEvent('ui', 'ui_channels_more_direct');
        this.setState({showDirectChannelsModal: true, startingUsers});
    }

    hideMoreDirectChannelsModal = () => {
        this.setState({showDirectChannelsModal: false, startingUsers: null});
    }

    openLeftSidebar = () => {
        if (Utils.isMobile()) {
            setTimeout(() => {
                document.querySelector('.app__body .inner-wrap').classList.add('move--right');
                document.querySelector('.app__body .sidebar--left').classList.add('move--right');
            });
        }
    }

    openQuickSwitcher = (e) => {
        e.preventDefault();
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_QUICK_SWITCH_MODAL
        });
    }

    createTutorialTip = () => {
        const screens = [];

        let townSquareDisplayName = Constants.DEFAULT_CHANNEL_UI_NAME;
        if (this.state.townSquare) {
            townSquareDisplayName = this.state.townSquare.display_name;
        }

        let offTopicDisplayName = Constants.OFFTOPIC_CHANNEL_UI_NAME;
        if (this.state.offTopic) {
            offTopicDisplayName = this.state.offTopic.display_name;
        }

        screens.push(
            <div>
                <FormattedHTMLMessage
                    id='sidebar.tutorialScreen1'
                    defaultMessage='<h4>Channels</h4><p><strong>Channels</strong> organize conversations across different topics. They’re open to everyone on your team. To send private communications use <strong>Direct Messages</strong> for a single person or <strong>Private Channels</strong> for multiple people.</p>'
                />
            </div>
        );

        screens.push(
            <div>
                <FormattedHTMLMessage
                    id='sidebar.tutorialScreen2'
                    defaultMessage='<h4>"{townsquare}" and "{offtopic}" channels</h4>
                    <p>Here are two public channels to start:</p>
                    <p><strong>{townsquare}</strong> is a place for team-wide communication. Everyone in your team is a member of this channel.</p>
                    <p><strong>{offtopic}</strong> is a place for fun and humor outside of work-related channels. You and your team can decide what other channels to create.</p>'
                    values={{
                        townsquare: townSquareDisplayName,
                        offtopic: offTopicDisplayName
                    }}
                />
            </div>
        );

        screens.push(
            <div>
                <FormattedHTMLMessage
                    id='sidebar.tutorialScreen3'
                    defaultMessage='<h4>Creating and Joining Channels</h4>
                    <p>Click <strong>"More..."</strong> to create a new channel or join an existing one.</p>
                    <p>You can also create a new public or private channel by clicking the <strong>"+" symbol</strong> next to the public or private channel header.</p>'
                />
            </div>
        );

        return (
            <TutorialTip
                placement='right'
                screens={screens}
                overlayClass='tip-overlay--sidebar'
                diagnosticsTag='tutorial_tip_2_channels'
            />
        );
    }

    createChannelElement = (channel, index, arr, handleClose) => {
        const members = this.state.members;
        const activeId = this.state.activeId;
        const channelMember = members[channel.id];
        const unreadCount = this.state.unreadCounts[channel.id] || {msgs: 0, mentions: 0};
        let msgCount;

        let linkClass = '';
        if (channel.id === activeId) {
            linkClass = 'active';
        }

        let rowClass = 'sidebar-item';

        var unread = false;
        if (channelMember) {
            msgCount = unreadCount.msgs + unreadCount.mentions;
            unread = msgCount > 0 || channelMember.mention_count > 0;
        }

        if (unread) {
            rowClass += ' unread-title';

            if (channel.id !== activeId) {
                if (!this.firstUnreadChannel) {
                    this.firstUnreadChannel = channel.name;
                }
                this.lastUnreadChannel = channel.name;
            }
        }

        var badge = null;
        if (channelMember) {
            if (unreadCount.mentions) {
                badge = <span className='badge'>{unreadCount.mentions}</span>;
                this.badgesActive = true;
            }
        } else if (this.state.loadingDMChannel === index && channel.type === Constants.DM_CHANNEL) {
            badge = (
                <img
                    className='channel-loading-gif pull-right'
                    src={loadingGif}
                />
            );
        }

        if (unreadCount.mentions > 0) {
            rowClass += ' has-badge';
        }

        var icon = null;
        const globeIcon = Constants.GLOBE_ICON_SVG;
        const lockIcon = Constants.LOCK_ICON_SVG;
        if (channel.type === Constants.OPEN_CHANNEL) {
            icon = (
                <span
                    className='icon icon__globe'
                    dangerouslySetInnerHTML={{__html: globeIcon}}
                />
            );
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            icon = (
                <span
                    className='icon icon__lock'
                    dangerouslySetInnerHTML={{__html: lockIcon}}
                />
            );
        } else if (channel.type === Constants.GM_CHANNEL) {
            icon = <div className='status status--group'>{UserStore.getProfileListInChannel(channel.id, true).length}</div>;
        } else {
            // set up status icon for direct message channels (status is null for other channel types)
            icon = (
                <StatusIcon
                    type='avatar'
                    status={channel.status}
                />);
        }

        let closeButton = null;
        let removeTooltip = (
            <Tooltip id='remove-dm-tooltip'>
                <FormattedMessage
                    id='sidebar.removeList'
                    defaultMessage='Remove from list'
                />
            </Tooltip>
        );
        if (channel.type === Constants.OPEN_CHANNEL || channel.type === Constants.PRIVATE_CHANNEL) {
            removeTooltip = (
                <Tooltip id='remove-dm-tooltip'>
                    <FormattedMessage
                        id='sidebar.leave'
                        defaultMessage='Leave channel'
                    />
                </Tooltip>
            );
        }
        if (handleClose && !badge) {
            closeButton = (
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={1000}
                    placement='top'
                    overlay={removeTooltip}
                >
                    <span
                        onClick={(e) => handleClose(e, channel)}
                        className='btn-close'
                    >
                        {'×'}
                    </span>
                </OverlayTrigger>
            );

            rowClass += ' has-close';
        }

        let tutorialTip = null;
        if (this.state.showTutorialTip && channel.name === Constants.DEFAULT_CHANNEL) {
            tutorialTip = this.createTutorialTip();
            this.openLeftSidebar();
        }

        let link = '';
        if (channel.fake) {
            link = '/' + this.state.currentTeam.name + '/channels/' + channel.name + '?fakechannel=' + encodeURIComponent(JSON.stringify(channel));
        } else {
            link = '/' + this.state.currentTeam.name + '/channels/' + channel.name;
        }

        const displayName = channel.display_name;

        return (
            <li
                key={channel.name}
                ref={channel.name}
                className={linkClass}
            >
                <Link
                    to={link}
                    className={rowClass}
                    onClick={this.trackChannelSelectedEvent}
                >
                    {icon}
                    <span className='sidebar-item__name'>{displayName}</span>
                    {badge}
                    {closeButton}
                </Link>
                {tutorialTip}
            </li>
        );
    }

    trackChannelSelectedEvent = () => {
        trackEvent('ui', 'ui_channel_selected');
    }

    render() {
        const switchChannelIcon = Constants.SWITCH_CHANNEL_ICON_SVG;

        // Check if we have all info needed to render
        if (this.state.currentTeam == null || this.state.currentUser == null) {
            return (<div/>);
        }

        this.lastBadgesActive = this.badgesActive;
        this.badgesActive = false;

        // keep track of the first and last unread channels so we can use them to set the unread indicators
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        // create elements for all 4 types of channels
        const favoriteItems = this.state.favoriteChannels.
            map((channel, index, arr) => {
                if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
                    return this.createChannelElement(channel, index, arr, this.handleLeaveDirectChannel);
                } else if (global.window.mm_config.EnableXToLeaveChannelsFromLHS === 'true') {
                    if (channel.type === Constants.OPEN_CHANNEL && channel.name !== Constants.DEFAULT_CHANNEL) {
                        return this.createChannelElement(channel, index, arr, this.handleLeavePublicChannel);
                    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
                        return this.createChannelElement(channel, index, arr, this.handleLeavePrivateChannel);
                    }
                }

                return this.createChannelElement(channel);
            });

        const publicChannelItems = this.state.publicChannels.map((channel, index, arr) => {
            if (global.window.mm_config.EnableXToLeaveChannelsFromLHS !== 'true' ||
                channel.name === Constants.DEFAULT_CHANNEL
            ) {
                return this.createChannelElement(channel);
            }
            return this.createChannelElement(channel, index, arr, this.handleLeavePublicChannel);
        });

        const privateChannelItems = this.state.privateChannels.map((channel, index, arr) => {
            if (global.window.mm_config.EnableXToLeaveChannelsFromLHS !== 'true') {
                return this.createChannelElement(channel);
            }
            return this.createChannelElement(channel, index, arr, this.handleLeavePrivateChannel);
        });

        const directMessageItems = this.state.directAndGroupChannels.map((channel, index, arr) => {
            return this.createChannelElement(channel, index, arr, this.handleLeaveDirectChannel);
        });

        // update the favicon to show if there are any notifications
        if (this.lastBadgesActive !== this.badgesActive) {
            var link = document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.id = 'favicon';
            if (this.badgesActive) {
                link.href = redFavicon;
            } else {
                link.href = favicon;
            }
            var head = document.getElementsByTagName('head')[0];
            var oldLink = document.getElementById('favicon');
            if (oldLink) {
                head.removeChild(oldLink);
            }
            head.appendChild(link);
        }

        var directMessageMore = (
            <li key='more'>
                <a
                    id='moreDirectMessage'
                    href='#'
                    onClick={this.handleOpenMoreDirectChannelsModal}
                >
                    <FormattedMessage
                        id='sidebar.moreElips'
                        defaultMessage='More...'
                    />
                </a>
            </li>
        );

        let showChannelModal = false;
        if (this.state.newChannelModalType !== '') {
            showChannelModal = true;
        }

        const createChannelTootlip = (
            <Tooltip id='new-channel-tooltip' >
                <FormattedMessage
                    id='sidebar.createChannel'
                    defaultMessage='Create new public channel'
                />
            </Tooltip>
        );
        const createGroupTootlip = (
            <Tooltip id='new-group-tooltip'>
                <FormattedMessage
                    id='sidebar.createGroup'
                    defaultMessage='Create new private channel'
                />
            </Tooltip>
        );

        const createDirectMessageTooltip = (
            <Tooltip
                id='new-group-tooltip'
                className='hidden-xs'
            >
                <FormattedMessage
                    id='sidebar.createDirectMessage'
                    defaultMessage='Create new direct message'
                />
            </Tooltip>
        );

        const above = (
            <FormattedMessage
                id='sidebar.unreads'
                defaultMessage='More unreads'
            />
        );

        const below = (
            <FormattedMessage
                id='sidebar.unreads'
                defaultMessage='More unreads'
            />
        );

        const isTeamAdmin = TeamStore.isTeamAdminForCurrentTeam();
        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();

        let createPublicChannelIcon = (
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={500}
                placement='top'
                overlay={createChannelTootlip}
            >
                <a
                    id='createPublicChannel'
                    className='add-channel-btn'
                    href='#'
                    onClick={this.showNewChannelModal.bind(this, Constants.OPEN_CHANNEL)}
                >
                    {'+'}
                </a>
            </OverlayTrigger>
        );

        let createPrivateChannelIcon = (
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={500}
                placement='top'
                overlay={createGroupTootlip}
            >
                <a
                    id='createPrivateChannel'
                    className='add-channel-btn'
                    href='#'
                    onClick={this.showNewChannelModal.bind(this, Constants.PRIVATE_CHANNEL)}
                >
                    {'+'}
                </a>
            </OverlayTrigger>
        );

        if (!ChannelUtils.showCreateOption(Constants.OPEN_CHANNEL, isTeamAdmin, isSystemAdmin)) {
            createPublicChannelIcon = null;
        }

        const createDirectMessageIcon = (
            <OverlayTrigger
                className='hidden-xs'
                delayShow={500}
                placement='top'
                overlay={createDirectMessageTooltip}
            >
                <a
                    className='add-channel-btn'
                    href='#'
                    onClick={this.handleOpenMoreDirectChannelsModal}
                >
                    {'+'}
                </a>
            </OverlayTrigger>
        );

        if (!ChannelUtils.showCreateOption(Constants.PRIVATE_CHANNEL, isTeamAdmin, isSystemAdmin)) {
            createPrivateChannelIcon = null;
        }

        let moreDirectChannelsModal;
        if (this.state.showDirectChannelsModal) {
            moreDirectChannelsModal = (
                <MoreDirectChannels
                    onModalDismissed={this.hideMoreDirectChannelsModal}
                    startingUsers={this.state.startingUsers}
                />
            );
        }

        let moreChannelsModal;
        if (this.state.showMoreChannelsModal) {
            moreChannelsModal = (
                <MoreChannels
                    onModalDismissed={this.hideMoreChannelsModal}
                    handleNewChannel={() => {
                        this.hideMoreChannelsModal();
                        this.showNewChannelModal(Constants.OPEN_CHANNEL);
                    }}
                />
            );
        }

        let quickSwitchTextShortcutId = 'quick_switch_modal.channelsShortcut.windows';
        let quickSwitchTextShortcutDefault = '- CTRL+K';
        if (Utils.isMac()) {
            quickSwitchTextShortcutId = 'quick_switch_modal.channelsShortcut.mac';
            quickSwitchTextShortcutDefault = '- ⌘K';
        }

        const quickSwitchTextShortcut = (
            <span className='switch__shortcut hidden-xs'>
                <FormattedMessage
                    id={quickSwitchTextShortcutId}
                    defaultMessage={quickSwitchTextShortcutDefault}
                />
            </span>
        );

        return (
            <div
                className='sidebar--left'
                id='sidebar-left'
                key='sidebar-left'
            >
                <NewChannelFlow
                    show={showChannelModal}
                    channelType={this.state.newChannelModalType}
                    onModalDismissed={this.hideNewChannelModal}
                />
                {moreDirectChannelsModal}
                {moreChannelsModal}

                <SidebarHeader
                    teamDisplayName={this.state.currentTeam.display_name}
                    teamDescription={this.state.currentTeam.description}
                    teamName={this.state.currentTeam.name}
                    teamType={this.state.currentTeam.type}
                    currentUser={this.state.currentUser}
                />

                <UnreadChannelIndicator
                    show={this.state.showTopUnread}
                    extraClass='nav-pills__unread-indicator-top'
                    text={above}
                />
                <UnreadChannelIndicator
                    show={this.state.showBottomUnread}
                    extraClass='nav-pills__unread-indicator-bottom'
                    text={below}
                />

                <div
                    ref='container'
                    className='nav-pills__container'
                    onScroll={this.onScroll}
                >
                    {favoriteItems.length !== 0 && <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                <FormattedMessage
                                    id='sidebar.favorite'
                                    defaultMessage='FAVORITE CHANNELS'
                                />
                            </h4>
                        </li>
                        {favoriteItems}
                    </ul>}
                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                <FormattedMessage
                                    id='sidebar.channels'
                                    defaultMessage='PUBLIC CHANNELS'
                                />
                                {createPublicChannelIcon}
                            </h4>
                        </li>
                        {publicChannelItems}
                        <li>
                            <a
                                id='sidebarChannelsMore'
                                href='#'
                                className='nav-more'
                                onClick={this.showMoreChannelsModal}
                            >
                                <FormattedMessage
                                    id='sidebar.moreElips'
                                    defaultMessage='More...'
                                />
                            </a>
                        </li>
                    </ul>

                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                <FormattedMessage
                                    id='sidebar.pg'
                                    defaultMessage='PRIVATE CHANNELS'
                                />
                                {createPrivateChannelIcon}
                            </h4>
                        </li>
                        {privateChannelItems}
                    </ul>
                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                <FormattedMessage
                                    id='sidebar.direct'
                                    defaultMessage='DIRECT MESSAGES'
                                />
                                {createDirectMessageIcon}
                            </h4>
                        </li>
                        {directMessageItems}
                        {directMessageMore}
                    </ul>
                </div>
                <div className='sidebar__switcher'>
                    <button
                        className='btn btn-link'
                        onClick={this.openQuickSwitcher}
                    >
                        <span
                            className='icon icon__switch'
                            dangerouslySetInnerHTML={{__html: switchChannelIcon}}
                        />
                        <FormattedMessage
                            id={'channel_switch_modal.title'}
                            defaultMessage='Switch Channels'
                        />
                        {quickSwitchTextShortcut}
                    </button>
                </div>
            </div>
        );
    }
}
