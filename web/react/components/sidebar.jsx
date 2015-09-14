// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var Utils = require('../utils/utils.jsx');
var SidebarHeader = require('./sidebar_header.jsx');
var SearchBox = require('./search_bar.jsx');
var Constants = require('../utils/constants.jsx');
var NewChannelFlow = require('./new_channel_flow.jsx');

export default class Sidebar extends React.Component {
    constructor(props) {
        super(props);

        this.badgesActive = false;
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        this.onChange = this.onChange.bind(this);
        this.onScroll = this.onScroll.bind(this);
        this.onResize = this.onResize.bind(this);
        this.updateUnreadIndicators = this.updateUnreadIndicators.bind(this);
        this.createChannelElement = this.createChannelElement.bind(this);

        this.state = this.getStateFromStores();
        this.state.modal = '';
        this.state.loadingDMChannel = -1;
    }
    getStateFromStores() {
        var members = ChannelStore.getAllMembers();
        var teamMemberMap = UserStore.getActiveOnlyProfiles();
        var currentId = ChannelStore.getCurrentId();

        var teammates = [];
        for (var id in teamMemberMap) {
            if (id === UserStore.getCurrentId()) {
                continue;
            }
            teammates.push(teamMemberMap[id]);
        }

        // Create lists of all read and unread direct channels
        var showDirectChannels = [];
        var readDirectChannels = [];
        for (var i = 0; i < teammates.length; i++) {
            var teammate = teammates[i];

            if (teammate.id === UserStore.getCurrentId()) {
                continue;
            }

            var channelName = '';
            if (teammate.id > UserStore.getCurrentId()) {
                channelName = UserStore.getCurrentId() + '__' + teammate.id;
            } else {
                channelName = teammate.id + '__' + UserStore.getCurrentId();
            }

            var channel = ChannelStore.getByName(channelName);

            if (channel != null) {
                channel.display_name = teammate.username;
                channel.teammate_username = teammate.username;

                channel.status = UserStore.getStatus(teammate.id);

                var channelMember = members[channel.id];
                var msgCount = channel.total_msg_count - channelMember.msg_count;
                if (msgCount > 0) {
                    showDirectChannels.push(channel);
                } else if (currentId === channel.id) {
                    showDirectChannels.push(channel);
                } else {
                    readDirectChannels.push(channel);
                }
            } else {
                var tempChannel = {};
                tempChannel.fake = true;
                tempChannel.name = channelName;
                tempChannel.display_name = teammate.username;
                tempChannel.teammate_username = teammate.username;
                tempChannel.status = UserStore.getStatus(teammate.id);
                tempChannel.last_post_at = 0;
                tempChannel.total_msg_count = 0;
                tempChannel.type = 'D';
                readDirectChannels.push(tempChannel);
            }
        }

        // If we don't have MAX_DMS unread channels, sort the read list by last_post_at
        if (showDirectChannels.length < Constants.MAX_DMS) {
            readDirectChannels.sort(function sortByLastPost(a, b) {
                // sort by last_post_at first
                if (a.last_post_at > b.last_post_at) {
                    return -1;
                }
                if (a.last_post_at < b.last_post_at) {
                    return 1;
                }

                // if last_post_at is equal, sort by name
                if (a.display_name < b.display_name) {
                    return -1;
                }
                if (a.display_name > b.display_name) {
                    return 1;
                }
                return 0;
            });

            var index = 0;
            while (showDirectChannels.length < Constants.MAX_DMS && index < readDirectChannels.length) {
                showDirectChannels.push(readDirectChannels[index]);
                index++;
            }
            readDirectChannels = readDirectChannels.slice(index);

            showDirectChannels.sort(function directSort(a, b) {
                if (a.display_name < b.display_name) {
                    return -1;
                }
                if (a.display_name > b.display_name) {
                    return 1;
                }
                return 0;
            });
        }

        return {
            activeId: currentId,
            channels: ChannelStore.getAll(),
            members: members,
            showDirectChannels: showDirectChannels,
            hideDirectChannels: readDirectChannels
        };
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
        SocketStore.addChangeListener(this.onSocketChange);
        $('.nav-pills__container').perfectScrollbar();

        this.updateTitle();
        this.updateUnreadIndicators();

        $(window).on('resize', this.onResize);
    }
    componentDidUpdate() {
        this.updateTitle();
        this.updateUnreadIndicators();
    }
    componentWillUnmount() {
        $(window).off('resize', this.onResize);

        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
        SocketStore.removeChangeListener(this.onSocketChange);
    }
    onChange() {
        var newState = this.getStateFromStores();
        if (!Utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    onSocketChange(msg) {
        if (msg.action === 'posted') {
            if (ChannelStore.getCurrentId() === msg.channel_id) {
                if (window.isActive) {
                    AsyncClient.updateLastViewedAt();
                }
            } else {
                AsyncClient.getChannels();
            }

            if (UserStore.getCurrentId() !== msg.user_id) {
                var mentions = [];
                if (msg.props.mentions) {
                    mentions = JSON.parse(msg.props.mentions);
                }
                var channel = ChannelStore.get(msg.channel_id);

                var user = UserStore.getCurrentUser();
                if (user.notify_props && ((user.notify_props.desktop === 'mention' && mentions.indexOf(user.id) === -1 && channel.type !== 'D') || user.notify_props.desktop === 'none')) {
                    return;
                }

                var member = ChannelStore.getMember(msg.channel_id);
                if ((member.notify_level === 'mention' && mentions.indexOf(user.id) === -1) || member.notify_level === 'none' || member.notify_level === 'quiet') {
                    return;
                }

                var username = 'Someone';
                if (UserStore.hasProfile(msg.user_id)) {
                    username = UserStore.getProfile(msg.user_id).username;
                }

                var title = 'Posted';
                if (channel) {
                    title = channel.display_name;
                }

                var repRegex = new RegExp('<br>', 'g');
                var post = JSON.parse(msg.props.post);
                var msgProps = msg.props;
                var notifyText = post.message.replace(repRegex, '\n').replace(/\n+/g, ' ').replace('<mention>', '').replace('</mention>', '');

                if (notifyText.length > 50) {
                    notifyText = notifyText.substring(0, 49) + '...';
                }

                if (notifyText.length === 0) {
                    if (msgProps.image) {
                        Utils.notifyMe(title, username + ' uploaded an image', channel);
                    } else if (msgProps.otherFile) {
                        Utils.notifyMe(title, username + ' uploaded a file', channel);
                    } else {
                        Utils.notifyMe(title, username + ' did something new', channel);
                    }
                } else {
                    Utils.notifyMe(title, username + ' wrote: ' + notifyText, channel);
                }
                if (!user.notify_props || user.notify_props.desktop_sound === 'true') {
                    Utils.ding();
                }
            }
        } else if (msg.action === 'viewed') {
            if (ChannelStore.getCurrentId() !== msg.channel_id && UserStore.getCurrentId() === msg.user_id) {
                AsyncClient.getChannel(msg.channel_id);
            }
        } else if (msg.action === 'user_added') {
            if (UserStore.getCurrentId() === msg.user_id) {
                AsyncClient.getChannel(msg.channel_id);
            }
        } else if (msg.action === 'user_removed') {
            if (msg.user_id === UserStore.getCurrentId()) {
                AsyncClient.getChannels(true);

                if (msg.props.channel_id === ChannelStore.getCurrentId() && $('#removed_from_channel').length > 0) {
                    var sentState = {};
                    sentState.channelName = ChannelStore.getCurrent().display_name;
                    sentState.remover = UserStore.getProfile(msg.props.remover).username;

                    BrowserStore.setItem('channel-removed-state', sentState);
                    $('#removed_from_channel').modal('show');
                }
            }
        }
    }
    updateTitle() {
        var channel = ChannelStore.getCurrent();
        if (channel) {
            if (channel.type === 'D') {
                var teammateUsername = Utils.getDirectTeammate(channel.id).username;
                document.title = teammateUsername + ' ' + document.title.substring(document.title.lastIndexOf('-'));
            } else {
                document.title = channel.display_name + ' ' + document.title.substring(document.title.lastIndexOf('-'));
            }
        }
    }
    onScroll() {
        this.updateUnreadIndicators();
    }
    onResize() {
        this.updateUnreadIndicators();
    }
    updateUnreadIndicators() {
        var container = $(React.findDOMNode(this.refs.container));

        if (this.firstUnreadChannel) {
            var firstUnreadElement = $(React.findDOMNode(this.refs[this.firstUnreadChannel]));

            if (firstUnreadElement.position().top + firstUnreadElement.height() < 0) {
                $(React.findDOMNode(this.refs.topUnreadIndicator)).css('display', 'initial');
            } else {
                $(React.findDOMNode(this.refs.topUnreadIndicator)).css('display', 'none');
            }
        }

        if (this.lastUnreadChannel) {
            var lastUnreadElement = $(React.findDOMNode(this.refs[this.lastUnreadChannel]));

            if (lastUnreadElement.position().top > container.height()) {
                $(React.findDOMNode(this.refs.bottomUnreadIndicator)).css('display', 'initial');
            } else {
                $(React.findDOMNode(this.refs.bottomUnreadIndicator)).css('display', 'none');
            }
        }
    }
    createChannelElement(channel, index) {
        var members = this.state.members;
        var activeId = this.state.activeId;
        var channelMember = members[channel.id];
        var msgCount;

        var linkClass = '';
        if (channel.id === activeId) {
            linkClass = 'active';
        }

        var unread = false;
        if (channelMember) {
            msgCount = channel.total_msg_count - channelMember.msg_count;
            unread = (msgCount > 0 && channelMember.notify_level !== 'quiet') || channelMember.mention_count > 0;
        }

        var titleClass = '';
        if (unread) {
            titleClass = 'unread-title';

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
                e.preventDefault();
                Utils.switchChannel(channel);
            };
        } else if (channel.fake && teamURL) {
            // It's a direct message channel that doesn't exist yet so let's create it now
            var otherUserId = Utils.getUserIdFromChannelName(channel);

            if (this.state.loadingDMChannel === -1) {
                handleClick = function clickHandler(e) {
                    e.preventDefault();
                    this.setState({loadingDMChannel: index});

                    Client.createDirectChannel(channel, otherUserId,
                        function success(data) {
                            this.setState({loadingDMChannel: -1});
                            AsyncClient.getChannel(data.id);
                            Utils.switchChannel(data);
                        }.bind(this),
                        function error() {
                            this.setState({loadingDMChannel: -1});
                            window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name;
                        }.bind(this)
                    );
                }.bind(this);
            }
        }

        return (
            <li
                key={channel.name}
                ref={channel.name}
                className={linkClass}
            >
                <a
                    className={'sidebar-channel ' + titleClass}
                    href={href}
                    onClick={handleClick}
                >
                    {status}
                    {channel.display_name}
                    {badge}
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
        var channelItems = this.state.channels.filter(
            function filterPublicChannels(channel) {
                return channel.type === 'O';
            }
        ).map(this.createChannelElement);

        var privateChannelItems = this.state.channels.filter(
            function filterPrivateChannels(channel) {
                return channel.type === 'P';
            }
        ).map(this.createChannelElement);

        var directMessageItems = this.state.showDirectChannels.map(this.createChannelElement);

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
        if (this.state.hideDirectChannels.length > 0) {
            directMessageMore = (
                <li>
                    <a
                        href='#'
                        data-toggle='modal'
                        className='nav-more'
                        data-target='#more_direct_channels'
                        data-channels={JSON.stringify(this.state.hideDirectChannels)}
                    >
                        {'More (' + this.state.hideDirectChannels.length + ')'}
                    </a>
                </li>
            );
        }

        let showChannelModal = false;
        if (this.state.modal !== '') {
            showChannelModal = true;
        }

        return (
            <div>
                <NewChannelFlow
                    show={showChannelModal}
                    channelType={this.state.modal}
                    onModalDismissed={() => this.setState({modal: ''})}
                />
                <SidebarHeader
                    teamDisplayName={this.props.teamDisplayName}
                    teamType={this.props.teamType}
                />
                <SearchBox />

                <div
                    ref='topUnreadIndicator'
                    className='nav-pills__unread-indicator nav-pills__unread-indicator-top'
                    style={{display: 'none'}}
                >
                    Unread post(s) above
                </div>
                <div
                    ref='bottomUnreadIndicator'
                    className='nav-pills__unread-indicator nav-pills__unread-indicator-bottom'
                    style={{display: 'none'}}
                >
                    Unread post(s) below
                </div>

                <div
                    ref='container'
                    className='nav-pills__container'
                    onScroll={this.onScroll}
                >
                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                Channels
                                <a
                                    className='add-channel-btn'
                                    href='#'
                                    onClick={() => this.setState({modal: 'O'})}
                                >
                                    {'+'}
                                </a>
                            </h4>
                        </li>
                        {channelItems}
                        <li>
                            <a
                                href='#'
                                data-toggle='modal'
                                className='nav-more'
                                data-target='#more_channels'
                                data-channeltype='O'
                            >
                                More...
                            </a>
                        </li>
                    </ul>

                    <ul className='nav nav-pills nav-stacked'>
                        <li>
                            <h4>
                                Private Groups
                                <a
                                    className='add-channel-btn'
                                    href='#'
                                    onClick={() => this.setState({modal: 'P'})}
                                >
                                    {'+'}
                                </a>
                            </h4>
                        </li>
                        {privateChannelItems}
                    </ul>
                    <ul className='nav nav-pills nav-stacked'>
                        <li><h4>Private Messages</h4></li>
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
    teamDisplayName: React.PropTypes.string
};
