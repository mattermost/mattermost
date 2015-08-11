// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var utils = require('../utils/utils.jsx');
var SidebarHeader = require('./sidebar_header.jsx');
var SearchBox = require('./search_bar.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function getStateFromStores() {
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
            tempChannel.display_name = utils.getDisplayName(teammate);
            tempChannel.status = UserStore.getStatus(teammate.id);
            tempChannel.last_post_at = 0;
            tempChannel.total_msg_count = 0;
            readDirectChannels.push(tempChannel);
        }
    }

    // If we don't have MAX_DMS unread channels, sort the read list by last_post_at
    if (showDirectChannels.length < Constants.MAX_DMS) {
        readDirectChannels.sort(function(a, b) {
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

        showDirectChannels.sort(function(a, b) {
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
        active_id: currentId,
        channels: ChannelStore.getAll(),
        members: members,
        showDirectChannels: showDirectChannels,
        hideDirectChannels: readDirectChannels
    };
}

module.exports = React.createClass({
    displayName: 'Sidebar',
    componentDidMount: function() {
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        SocketStore.addChangeListener(this.onSocketChange);
        $('.nav-pills__container').perfectScrollbar();

        this.updateTitle();
        this.updateUnreadIndicators();

        $(window).on('resize', this.onResize);
    },
    componentDidUpdate: function() {
        this.updateTitle();
        this.updateUnreadIndicators();
    },
    componentWillUnmount: function() {
        $(window).off('resize', this.onResize);

        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        SocketStore.removeChangeListener(this.onSocketChange);
    },
    onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    onSocketChange: function(msg) {
        if (msg.action === 'posted') {
            if (ChannelStore.getCurrentId() === msg.channel_id) {
                AsyncClient.getChannels(true, window.isActive);
            } else {
                AsyncClient.getChannels(true);
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
                        utils.notifyMe(title, username + ' uploaded an image', channel);
                    } else if (msgProps.otherFile) {
                        utils.notifyMe(title, username + ' uploaded a file', channel);
                    } else {
                        utils.notifyMe(title, username + ' did something new', channel);
                    }
                } else {
                    utils.notifyMe(title, username + ' wrote: ' + notifyText, channel);
                }
                if (!user.notify_props || user.notify_props.desktop_sound === 'true') {
                    utils.ding();
                }
            }
        } else if (msg.action === 'viewed') {
            if (ChannelStore.getCurrentId() != msg.channel_id) {
                AsyncClient.getChannels(true);
            }
        } else if (msg.action === 'user_added') {
            if (UserStore.getCurrentId() === msg.user_id) {
                AsyncClient.getChannels(true);
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
    },
    updateTitle: function() {
        var channel = ChannelStore.getCurrent();
        if (channel) {
            if (channel.type === 'D') {
                var teammate_username = utils.getDirectTeammate(channel.id).username;
                document.title = teammate_username + ' ' + document.title.substring(document.title.lastIndexOf('-'));
            } else {
                document.title = channel.display_name + ' ' + document.title.substring(document.title.lastIndexOf('-'));
            }
        }
    },
    onScroll: function(e) {
        this.updateUnreadIndicators();
    },
    onResize: function(e) {
        this.updateUnreadIndicators();
    },
    updateUnreadIndicators: function() {
        var container = $(this.refs.container.getDOMNode());

        if (this.firstUnreadChannel) {
            var firstUnreadElement = $(this.refs[this.firstUnreadChannel].getDOMNode());

            if (firstUnreadElement.position().top + firstUnreadElement.height() < 0) {
                $(this.refs.topUnreadIndicator.getDOMNode()).css('display', 'initial');
            } else {
                $(this.refs.topUnreadIndicator.getDOMNode()).css('display', 'none');
            }
        }

        if (this.lastUnreadChannel) {
            var lastUnreadElement = $(this.refs[this.lastUnreadChannel].getDOMNode());

            if (lastUnreadElement.position().top > container.height()) {
                $(this.refs.bottomUnreadIndicator.getDOMNode()).css('bottom', '0');
                $(this.refs.bottomUnreadIndicator.getDOMNode()).css('display', 'initial');
            } else {
                $(this.refs.bottomUnreadIndicator.getDOMNode()).css('display', 'none');
            }
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var members = this.state.members;
        var activeId = this.state.active_id;
        var badgesActive = false;

        // keep track of the first and last unread channels so we can use them to set the unread indicators
        var self = this;
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;

        function createChannelElement(channel) {
            var channelMember = members[channel.id];

            var linkClass = '';
            if (channel.id === self.state.active_id) {
                linkClass = 'active';
            }

            var unread = false;
            if (channelMember) {
                var msgCount = channel.total_msg_count - channelMember.msg_count;
                unread = (msgCount > 0 && channelMember.notify_level !== 'quiet') || channelMember.mention_count > 0;
            }

            var titleClass = '';
            if (unread) {
                titleClass = 'unread-title';

                if (!self.firstUnreadChannel) {
                    self.firstUnreadChannel = channel.name;
                }
                self.lastUnreadChannel = channel.name;
            }

            var badge = null;
            if (channelMember) {
                if (channel.type === 'D') {
                    // direct message channels show badges for any number of unread posts
                    var msgCount = channel.total_msg_count - channelMember.msg_count;
                    if (msgCount > 0) {
                        badge = <span className='badge pull-right small'>{msgCount}</span>;
                        badgesActive = true;
                    }
                } else if (channelMember.mention_count > 0) {
                    // public and private channels only show badges for mentions
                    badge = <span className='badge pull-right small'>{channelMember.mention_count}</span>;
                    badgesActive = true;
                }
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
                status = <span className='status' dangerouslySetInnerHTML={{__html: statusIcon}} />;
            }

            // set up click handler to switch channels (or create a new channel for non-existant ones)
            var clickHandler = null;
            var href;
            if (!channel.fake) {
                clickHandler = function(e) {
                    e.preventDefault();
                    utils.switchChannel(channel);
                };
                href = '#';
            } else {
                href = TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name;
            }

            return (
                <li key={channel.name} ref={channel.name} className={linkClass}>
                    <a className={'sidebar-channel ' + titleClass} href={href} onClick={clickHandler}>
                        {status}
                        {badge}
                        {channel.display_name}
                    </a>
                </li>
            );
        };

        // create elements for all 3 types of channels
        var channelItems = this.state.channels.filter(
            function(channel) {
                return channel.type === 'O';
            }
        ).map(createChannelElement);

        var privateChannelItems = this.state.channels.filter(
            function(channel) {
                return channel.type === 'P';
            }
        ).map(createChannelElement);

        var directMessageItems = this.state.showDirectChannels.map(createChannelElement);

        // update the favicon to show if there are any notifications
        var link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.id = 'favicon';
        if (badgesActive) {
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
                    <a href='#' data-toggle='modal' className='nav-more' data-target='#more_direct_channels' data-channels={JSON.stringify(this.state.hideDirectChannels)}>
                        {'More ('+this.state.hideDirectChannels.length+')'}
                    </a>
                </li>
            );
        }

        return (
            <div>
                <SidebarHeader teamDisplayName={this.props.teamDisplayName} teamType={this.props.teamType} />
                <SearchBox />

                <div ref='topUnreadIndicator' className='nav-pills__unread-indicator nav-pills__unread-indicator-top' style={{display: 'none'}}>Unread post(s) above</div>
                <div ref='bottomUnreadIndicator' className='nav-pills__unread-indicator nav-pills__unread-indicator-bottom' style={{display: 'none'}}>Unread post(s) below</div>

                <div ref='container' className='nav-pills__container' onScroll={this.onScroll}>
                    <ul className='nav nav-pills nav-stacked'>
                        <li><h4>Channels<a className='add-channel-btn' href='#' data-toggle='modal' data-target='#new_channel' data-channeltype='O'>+</a></h4></li>
                        {channelItems}
                        <li><a href='#' data-toggle='modal' className='nav-more' data-target='#more_channels' data-channeltype='O'>More...</a></li>
                    </ul>

                    <ul className='nav nav-pills nav-stacked'>
                        <li><h4>Private Groups<a className='add-channel-btn' href='#' data-toggle='modal' data-target='#new_channel' data-channeltype='P'>+</a></h4></li>
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
});
