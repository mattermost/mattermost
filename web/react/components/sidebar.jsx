// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import NewChannelFlow from './new_channel_flow.jsx';
import MoreDirectChannels from './more_direct_channels.jsx';
import SearchBox from './search_bar.jsx';
import SidebarHeader from './sidebar_header.jsx';
import UnreadChannelIndicator from './unread_channel_indicator.jsx';
import TutorialTip from './tutorial/tutorial_tip.jsx';

import ChannelStore from '../stores/channel_store.jsx';
import UserStore from '../stores/user_store.jsx';
import TeamStore from '../stores/team_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';

import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';

import Constants from '../utils/constants.jsx';
const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;
const NotificationPrefs = Constants.NotificationPrefs;

const Tooltip = ReactBootstrap.Tooltip;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class Sidebar extends React.Component {
    constructor(props) {
        super(props);

        this.badgesActive = false;
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        this.getStateFromStores = this.getStateFromStores.bind(this);

        this.onChange = this.onChange.bind(this);
        this.onScroll = this.onScroll.bind(this);
        this.updateUnreadIndicators = this.updateUnreadIndicators.bind(this);
        this.handleLeaveDirectChannel = this.handleLeaveDirectChannel.bind(this);
        this.updateScrollbar = this.updateScrollbar.bind(this);
        this.handleResize = this.handleResize.bind(this);

        this.showNewChannelModal = this.showNewChannelModal.bind(this);
        this.hideNewChannelModal = this.hideNewChannelModal.bind(this);
        this.showMoreDirectChannelsModal = this.showMoreDirectChannelsModal.bind(this);
        this.hideMoreDirectChannelsModal = this.hideMoreDirectChannelsModal.bind(this);

        this.createChannelElement = this.createChannelElement.bind(this);
        this.updateTitle = this.updateTitle.bind(this);
        this.setUnreadCountPerChannel = this.setUnreadCountPerChannel.bind(this);
        this.getUnreadCount = this.getUnreadCount.bind(this);

        this.isLeaving = new Map();

        const state = this.getStateFromStores();
        state.newChannelModalType = '';
        state.showDirectChannelsModal = false;
        state.loadingDMChannel = -1;
        state.windowWidth = Utils.windowWidth();
        this.state = state;

        this.unreadCountPerChannel = {};
        this.setUnreadCountPerChannel();
    }
    setUnreadCountPerChannel() {
        const channels = ChannelStore.getAll();
        const members = ChannelStore.getAllMembers();
        const channelUnreadCounts = {};

        channels.forEach((ch) => {
            const chMember = members[ch.id];
            let chMentionCount = chMember.mention_count;
            let chUnreadCount = ch.total_msg_count - chMember.msg_count - chMentionCount;

            if (ch.type === 'D') {
                chMentionCount = chUnreadCount;
                chUnreadCount = 0;
            } else if (chMember.notify_props && chMember.notify_props.mark_unread === NotificationPrefs.MENTION) {
                chUnreadCount = 0;
            }

            channelUnreadCounts[ch.id] = {msgs: chUnreadCount, mentions: chMentionCount};
        });

        this.unreadCountPerChannel = channelUnreadCounts;
    }
    getUnreadCount(channelId) {
        let mentions = 0;
        let msgs = 0;

        if (channelId) {
            return this.unreadCountPerChannel[channelId] ? this.unreadCountPerChannel[channelId] : {msgs, mentions};
        }

        Object.keys(this.unreadCountPerChannel).forEach((chId) => {
            msgs += this.unreadCountPerChannel[chId].msgs;
            mentions += this.unreadCountPerChannel[chId].mentions;
        });

        return {msgs, mentions};
    }
    getStateFromStores() {
        const members = ChannelStore.getAllMembers();
        const currentChannelId = ChannelStore.getCurrentId();

        const channels = Object.assign([], ChannelStore.getAll());
        channels.sort((a, b) => a.display_name.localeCompare(b.display_name));

        const publicChannels = channels.filter((channel) => channel.type === Constants.OPEN_CHANNEL);
        const privateChannels = channels.filter((channel) => channel.type === Constants.PRIVATE_CHANNEL);
        const directChannels = channels.filter((channel) => channel.type === Constants.DM_CHANNEL);

        const preferences = PreferenceStore.getPreferences(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);

        var visibleDirectChannels = [];
        for (var i = 0; i < directChannels.length; i++) {
            const dm = directChannels[i];
            const teammate = Utils.getDirectTeammate(dm.id);
            if (!teammate) {
                continue;
            }

            const member = members[dm.id];
            const msgCount = dm.total_msg_count - member.msg_count;

            // always show a channel if either it is the current one or if it is unread, but it is not currently being left
            const forceShow = (currentChannelId === dm.id || msgCount > 0) && !this.isLeaving.get(dm.id);
            const preferenceShow = preferences.some((preference) => (preference.name === teammate.id && preference.value !== 'false'));

            if (preferenceShow || forceShow) {
                dm.display_name = Utils.displayUsername(teammate.id);
                dm.teammate_id = teammate.id;
                dm.status = UserStore.getStatus(teammate.id);

                visibleDirectChannels.push(dm);

                if (forceShow && !preferenceShow) {
                    // make sure that unread direct channels are visible
                    const preference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammate.id, 'true');
                    AsyncClient.savePreferences([preference]);
                }
            }
        }

        const hiddenDirectChannelCount = UserStore.getActiveOnlyProfileList(true).length - visibleDirectChannels.length;

        visibleDirectChannels.sort(this.sortChannelsByDisplayName);

        const tutorialPref = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '999'});

        return {
            activeId: currentChannelId,
            members,
            publicChannels,
            privateChannels,
            visibleDirectChannels,
            hiddenDirectChannelCount,
            showTutorialTip: parseInt(tutorialPref.value, 10) === TutorialSteps.CHANNEL_POPOVER
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onChange);

        this.updateTitle();
        this.updateUnreadIndicators();
        this.updateScrollbar();

        window.addEventListener('resize', this.handleResize);
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState, this.state)) {
            return true;
        }
        return false;
    }
    componentDidUpdate() {
        this.updateTitle();
        this.updateUnreadIndicators();
        this.updateScrollbar();
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);

        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onChange);
    }
    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }
    updateScrollbar() {
    }
    onChange() {
        this.setState(this.getStateFromStores());
    }
    updateTitle() {
        const channel = ChannelStore.getCurrent();
        if (channel) {
            let currentSiteName = '';
            if (global.window.mm_config.SiteName != null) {
                currentSiteName = global.window.mm_config.SiteName;
            }

            let currentChannelName = channel.display_name;
            if (channel.type === 'D') {
                currentChannelName = Utils.getDirectTeammate(channel.id).username;
            }

            const unread = this.getUnreadCount();
            const mentionTitle = unread.mentions > 0 ? '(' + unread.mentions + ') ' : '';
            const unreadTitle = unread.msgs > 0 ? '* ' : '';
            document.title = mentionTitle + unreadTitle + currentChannelName + ' - ' + TeamStore.getCurrent().display_name + ' ' + currentSiteName;
        }
    }
    onScroll() {
        this.updateUnreadIndicators();
    }
    updateUnreadIndicators() {
        const container = $(ReactDOM.findDOMNode(this.refs.container));

        var showTopUnread = false;
        var showBottomUnread = false;

        if (this.firstUnreadChannel) {
            var firstUnreadElement = $(ReactDOM.findDOMNode(this.refs[this.firstUnreadChannel]));

            if (firstUnreadElement.position().top + firstUnreadElement.height() < 0) {
                showTopUnread = true;
            }
        }

        if (this.lastUnreadChannel) {
            var lastUnreadElement = $(ReactDOM.findDOMNode(this.refs[this.lastUnreadChannel]));

            if (lastUnreadElement.position().top > container.height()) {
                showBottomUnread = true;
            }
        }

        this.setState({
            showTopUnread,
            showBottomUnread
        });
    }

    handleLeaveDirectChannel(channel) {
        if (!this.isLeaving.get(channel.id)) {
            this.isLeaving.set(channel.id, true);

            const preference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, channel.teammate_id, 'false');

            // bypass AsyncClient since we've already saved the updated preferences
            Client.savePreferences(
                [preference],
                () => {
                    this.isLeaving.set(channel.id, false);
                },
                () => {
                    this.isLeaving.set(channel.id, false);
                }
            );

            this.setState(this.getStateFromStores());
        }

        if (channel.id === this.state.activeId) {
            Utils.switchChannel(ChannelStore.getByName(Constants.DEFAULT_CHANNEL));
        }
    }

    sortChannelsByDisplayName(a, b) {
        return a.display_name.localeCompare(b.display_name);
    }

    showNewChannelModal(type) {
        this.setState({newChannelModalType: type});
    }
    hideNewChannelModal() {
        this.setState({newChannelModalType: ''});
    }

    showMoreDirectChannelsModal() {
        this.setState({showDirectChannelsModal: true});
    }
    hideMoreDirectChannelsModal() {
        this.setState({showDirectChannelsModal: false});
    }

    createTutorialTip() {
        const screens = [];

        screens.push(
            <div>
                <h4>{'Channels'}</h4>
                <p><strong>{'Channels'}</strong>{' organize conversations across different topics. They’re open to everyone on your team. To send private communications use '}<strong>{'Direct Messages'}</strong>{' for a single person or '}<strong>{'Private Groups'}</strong>{' for multiple people.'}
                </p>
            </div>
        );

        screens.push(
            <div>
                <h4>{'"Town Square" and "Off-Topic" channels'}</h4>
                <p>{'Here are two public channels to start:'}</p>
                <p>
                    <strong>{'Town Square'}</strong>{' is a place for team-wide communication. Everyone in your team is a member of this channel.'}
                </p>
                <p>
                    <strong>{'Off-Topic'}</strong>{' is a place for fun and humor outside of work-related channels. You and your team can decide what other channels to create.'}
                </p>
            </div>
        );

        screens.push(
            <div>
                <h4>{'Creating and Joining Channels'}</h4>
                <p>
                    {'Click '}<strong>{'"More..."'}</strong>{' to create a new channel or join an existing one.'}
                </p>
                <p>
                    {'You can also create a new channel or private group by clicking the '}<strong>{'"+" symbol'}</strong>{' next to the channel or private group header.'}
                </p>
            </div>
        );

        return (
            <TutorialTip
                placement='right'
                screens={screens}
                overlayClass='tip-overlay--sidebar'
            />
        );
    }

    createChannelElement(channel, index, arr, handleClose) {
        var members = this.state.members;
        var activeId = this.state.activeId;
        var channelMember = members[channel.id];
        var unreadCount = this.getUnreadCount(channel.id);
        var msgCount;

        var linkClass = '';
        if (channel.id === activeId) {
            linkClass = 'active';
        }

        let rowClass = 'sidebar-channel';

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
                badge = <span className='badge pull-right small'>{unreadCount.mentions}</span>;
                this.badgesActive = true;
            }
        } else if (this.state.loadingDMChannel === index && channel.type === 'D') {
            badge = (
                <img
                    className='channel-loading-gif pull-right'
                    src='/static/images/load.gif'
                />
            );
        }

        if (msgCount > 0) {
            rowClass += ' has-badge';
        }

        // set up status icon for direct message channels
        var status = null;
        if (channel.type === 'D') {
            var statusIcon = '';
            if (channel.status === 'online') {
                statusIcon = Constants.ONLINE_ICON_SVG;
            } else if (channel.status === 'away') {
                statusIcon = Constants.ONLINE_ICON_SVG;
            } else {
                statusIcon = Constants.OFFLINE_ICON_SVG;
            }
            status = (
                <span
                    className='status'
                    dangerouslySetInnerHTML={{__html: statusIcon}}
                />
            );
        }

        // set up click handler to switch channels (or create a new channel for non-existant ones)
        var handleClick = null;
        var href = '#';
        var teamURL = TeamStore.getCurrentTeamUrl();

        if (!channel.fake) {
            handleClick = function clickHandler(e) {
                if (e.target.attributes.getNamedItem('data-close')) {
                    handleClose(channel);
                } else {
                    Utils.switchChannel(channel);
                }

                e.preventDefault();
            };
        } else if (channel.fake && teamURL) {
            // It's a direct message channel that doesn't exist yet so let's create it now
            var otherUserId = Utils.getUserIdFromChannelName(channel);

            if (this.state.loadingDMChannel === -1) {
                handleClick = function clickHandler(e) {
                    e.preventDefault();

                    if (e.target.attributes.getNamedItem('data-close')) {
                        handleClose(channel);
                    } else {
                        this.setState({loadingDMChannel: index});

                        Client.createDirectChannel(channel, otherUserId,
                            (data) => {
                                this.setState({loadingDMChannel: -1});
                                AsyncClient.getChannel(data.id);
                                Utils.switchChannel(data);
                            },
                            () => {
                                this.setState({loadingDMChannel: -1});
                                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name;
                            }
                        );
                    }
                }.bind(this);
            }
        }

        let closeButton = null;
        const removeTooltip = (
            <Tooltip id='remove-dm-tooltip'>{'Remove from list'}</Tooltip>
        );
        if (handleClose && !badge) {
            closeButton = (
                <OverlayTrigger
                    delayShow={1000}
                    placement='top'
                    overlay={removeTooltip}
                >
                <span
                    className='btn-close'
                    data-close='true'
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
        }

        return (
            <li
                key={channel.name}
                ref={channel.name}
                className={linkClass}
            >
                <a
                    className={rowClass}
                    href={href}
                    onClick={handleClick}
                >
                    {status}
                    {channel.display_name}
                    {badge}
                    {closeButton}
                </a>
                {tutorialTip}
            </li>
        );
    }
    render() {
        this.badgesActive = false;

        this.setUnreadCountPerChannel();

        // keep track of the first and last unread channels so we can use them to set the unread indicators
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        // create elements for all 3 types of channels
        const publicChannelItems = this.state.publicChannels.map(this.createChannelElement);

        const privateChannelItems = this.state.privateChannels.map(this.createChannelElement);

        const directMessageItems = this.state.visibleDirectChannels.map((channel, index, arr) => {
            return this.createChannelElement(channel, index, arr, this.handleLeaveDirectChannel);
        });

        // update the favicon to show if there are any notifications
        var link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.id = 'favicon';
        if (this.badgesActive) {
            link.href = '/static/images/redfavicon.ico';
        } else {
            link.href = '/static/images/favicon.ico';
        }
        var head = document.getElementsByTagName('head')[0];
        var oldLink = document.getElementById('favicon');
        if (oldLink) {
            head.removeChild(oldLink);
        }
        head.appendChild(link);

        var directMessageMore = null;
        if (this.state.hiddenDirectChannelCount > 0) {
            directMessageMore = (
                <li key='more'>
                    <a
                        href='#'
                        onClick={this.showMoreDirectChannelsModal}
                    >
                        {'More (' + this.state.hiddenDirectChannelCount + ')'}
                    </a>
                </li>
            );
        }

        let showChannelModal = false;
        if (this.state.newChannelModalType !== '') {
            showChannelModal = true;
        }

        const createChannelTootlip = (
            <Tooltip id='new-channel-tooltip' >{'Create new channel'}</Tooltip>
        );
        const createGroupTootlip = (
            <Tooltip id='new-group-tooltip'>{'Create new group'}</Tooltip>
        );

        return (
            <div>
                <NewChannelFlow
                    show={showChannelModal}
                    channelType={this.state.newChannelModalType}
                    onModalDismissed={this.hideNewChannelModal}
                />
                <MoreDirectChannels
                    show={this.state.showDirectChannelsModal}
                    onModalDismissed={this.hideMoreDirectChannelsModal}
                />

                <SidebarHeader
                    teamDisplayName={TeamStore.getCurrent().display_name}
                    teamName={TeamStore.getCurrent().name}
                    teamType={TeamStore.getCurrent().type}
                />
                <SearchBox />

                <UnreadChannelIndicator
                    show={this.state.showTopUnread}
                    extraClass='nav-pills__unread-indicator-top'
                    text={'Unread post(s) above'}
                />
                <UnreadChannelIndicator
                    show={this.state.showBottomUnread}
                    extraClass='nav-pills__unread-indicator-bottom'
                    text={'Unread post(s) below'}
                />

                <div
                    ref='container'
                    className='nav-pills__container'
                    onScroll={this.onScroll}
                >
                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                {'Channels'}
                                <OverlayTrigger
                                    delayShow={500}
                                    placement='top'
                                    overlay={createChannelTootlip}
                                >
                                <a
                                    className='add-channel-btn'
                                    href='#'
                                    onClick={this.showNewChannelModal.bind(this, 'O')}
                                >
                                    {'+'}
                                </a>
                                </OverlayTrigger>
                            </h4>
                        </li>
                        {publicChannelItems}
                        <li>
                            <a
                                href='#'
                                data-toggle='modal'
                                className='nav-more'
                                data-target='#more_channels'
                                data-channeltype='O'
                            >
                                {'More...'}
                            </a>
                        </li>
                    </ul>

                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                {'Private Groups'}
                                <OverlayTrigger
                                    delayShow={500}
                                    placement='top'
                                    overlay={createGroupTootlip}
                                >
                                <a
                                    className='add-channel-btn'
                                    href='#'
                                    onClick={this.showNewChannelModal.bind(this, 'P')}
                                >
                                    {'+'}
                                </a>
                                </OverlayTrigger>
                            </h4>
                        </li>
                        {privateChannelItems}
                    </ul>
                    <ul className='nav nav-pills nav-stacked'>
                        <li><h4>{'Direct Messages'}</h4></li>
                        {directMessageItems}
                        {directMessageMore}
                    </ul>
                </div>
            </div>
        );
    }
}

Sidebar.defaultProps = {
};
Sidebar.propTypes = {
};
