// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AsyncClient = require('../utils/async_client.jsx');
const ChannelStore = require('../stores/channel_store.jsx');
const Client = require('../utils/client.jsx');
const Constants = require('../utils/constants.jsx');
const PreferenceStore = require('../stores/preference_store.jsx');
const NewChannelFlow = require('./new_channel_flow.jsx');
const MoreDirectChannels = require('./more_direct_channels.jsx');
const SearchBox = require('./search_bar.jsx');
const SidebarHeader = require('./sidebar_header.jsx');
const TeamStore = require('../stores/team_store.jsx');
const UnreadChannelIndicator = require('./unread_channel_indicator.jsx');
const UserStore = require('../stores/user_store.jsx');
const Utils = require('../utils/utils.jsx');
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

        this.isLeaving = new Map();

        const state = this.getStateFromStores();
        state.newChannelModalType = '';
        state.showDirectChannelsModal = false;
        state.loadingDMChannel = -1;
        state.windowWidth = Utils.windowWidth();

        this.state = state;
    }
    getStateFromStores() {
        const members = ChannelStore.getAllMembers();
        var teamMemberMap = UserStore.getActiveOnlyProfiles();
        var currentId = ChannelStore.getCurrentId();
        const currentUserId = UserStore.getCurrentId();

        var teammates = [];
        for (var id in teamMemberMap) {
            if (id === currentUserId) {
                continue;
            }
            teammates.push(teamMemberMap[id]);
        }

        const preferences = PreferenceStore.getPreferences(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);

        var visibleDirectChannels = [];
        var hiddenDirectChannelCount = 0;
        for (var i = 0; i < teammates.length; i++) {
            const teammate = teammates[i];

            if (teammate.id === currentUserId) {
                continue;
            }

            const channelName = Utils.getDirectChannelName(currentUserId, teammate.id);

            let forceShow = false;
            let channel = ChannelStore.getByName(channelName);

            if (channel) {
                const member = members[channel.id];
                const msgCount = channel.total_msg_count - member.msg_count;

                // always show a channel if either it is the current one or if it is unread, but it is not currently being left
                forceShow = (currentId === channel.id || msgCount > 0) && !this.isLeaving.get(channel.id);
            } else {
                channel = {};
                channel.fake = true;
                channel.name = channelName;
                channel.last_post_at = 0;
                channel.total_msg_count = 0;
                channel.type = 'D';
            }

            channel.display_name = teammate.username;
            channel.teammate_id = teammate.id;
            channel.status = UserStore.getStatus(teammate.id);

            if (preferences.some((preference) => (preference.name === teammate.id && preference.value !== 'false'))) {
                visibleDirectChannels.push(channel);
            } else if (forceShow) {
                // make sure that unread direct channels are visible
                const preference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammate.id, 'true');
                AsyncClient.savePreferences([preference]);

                visibleDirectChannels.push(channel);
            } else {
                hiddenDirectChannelCount += 1;
            }
        }

        visibleDirectChannels.sort(this.sortChannelsByDisplayName);

        return {
            activeId: currentId,
            channels: ChannelStore.getAll(),
            members,
            visibleDirectChannels,
            hiddenDirectChannelCount
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
        if (!Utils.areStatesEqual(nextProps, this.props)) {
            return true;
        }

        if (!Utils.areStatesEqual(nextState, this.state)) {
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
        if (this.state.windowWidth > 768) {
            $('.nav-pills__container').perfectScrollbar();
            $('.nav-pills__container').perfectScrollbar('update');
        }
    }
    onChange() {
        var newState = this.getStateFromStores();
        if (!Utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    updateTitle() {
        const channel = ChannelStore.getCurrent();
        if (channel) {
            let currentSiteName = '';
            if (global.window.config.SiteName != null) {
                currentSiteName = global.window.config.SiteName;
            }

            let currentChannelName = channel.display_name;
            if (channel.type === 'D') {
                currentChannelName = Utils.getDirectTeammate(channel.id).username;
            }

            document.title = currentChannelName + ' - ' + this.props.teamDisplayName + ' ' + currentSiteName;
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

    createChannelElement(channel, index, arr, handleClose) {
        var members = this.state.members;
        var activeId = this.state.activeId;
        var channelMember = members[channel.id];
        var msgCount;

        var linkClass = '';
        if (channel.id === activeId) {
            linkClass = 'active';
        }

        let rowClass = 'sidebar-channel';

        var unread = false;
        if (channelMember) {
            msgCount = channel.total_msg_count - channelMember.msg_count;
            unread = (msgCount > 0 && channelMember.notify_props.mark_unread !== 'mention') || channelMember.mention_count > 0;
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
            if (channel.type === 'D') {
                // direct message channels show badges for any number of unread posts
                msgCount = channel.total_msg_count - channelMember.msg_count;
                if (msgCount > 0) {
                    badge = <span className='badge pull-right small'>{msgCount}</span>;
                    this.badgesActive = true;
                }
            } else if (channelMember.mention_count > 0) {
                // public and private channels only show badges for mentions
                badge = <span className='badge pull-right small'>{channelMember.mention_count}</span>;
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
            </li>
        );
    }
    render() {
        this.badgesActive = false;

        // keep track of the first and last unread channels so we can use them to set the unread indicators
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        // create elements for all 3 types of channels
        const publicChannels = this.state.channels.filter((channel) => channel.type === 'O');
        const publicChannelItems = publicChannels.map(this.createChannelElement);

        const privateChannels = this.state.channels.filter((channel) => channel.type === 'P');
        const privateChannelItems = privateChannels.map(this.createChannelElement);

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
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                    teamType={this.props.teamType}
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
    teamType: '',
    teamDisplayName: ''
};
Sidebar.propTypes = {
    teamType: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    teamName: React.PropTypes.string
};
