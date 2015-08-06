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
var marked = require('marked');

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
                channel.unread = msgCount;
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
    },
    componentDidUpdate: function() {
        this.updateTitle();
    },
    componentWillUnmount: function() {
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
                var mentions = msg.props.mentions ? JSON.parse(msg.props.mentions) : [];
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

                var title = channel ? channel.display_name : 'Posted';

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
                    var useMarkdown = config.AllowMarkdown;
                    if (useMarkdown) {
                        notifyText = marked(notifyText, {sanitize: false, mangle: false, gfm: true, breaks: true, tables: false, smartypants: true, renderer: utils.customMarkedRenderer({disable: true})});
                    }
                    notifyText = utils.replaceHtmlEntities(notifyText);
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
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var members = this.state.members;
        var newsActive = window.location.pathname === '/' ? 'active' : '';
        var badgesActive = false;
        var self = this;
        var channelItems = this.state.channels.map(function(channel) {
            if (channel.type != 'O') {
                return '';
            }

            var channelMember = members[channel.id];
            var active = channel.id === self.state.active_id ? 'active' : '';

            var msgCount = channel.total_msg_count - channelMember.msg_count;
            var titleClass = '';
            if (msgCount > 0 && channelMember.notify_level !== 'quiet') {
                titleClass = 'unread-title';
            }

            var badge = '';
            if (channelMember.mention_count > 0) {
                badge = <span className='badge pull-right small'>{channelMember.mention_count}</span>;
                badgesActive = true;
                titleClass = 'unread-title';
            }

            return (
                <li key={channel.id} className={active}><a className={'sidebar-channel ' + titleClass} href='#' onClick={function(e){e.preventDefault(); utils.switchChannel(channel);}}>{badge}{channel.display_name}</a></li>
            );
        });

        var privateChannelItems = this.state.channels.map(function(channel) {
            if (channel.type !== 'P') {
                return '';
            }

            var channelMember = members[channel.id];
            var active = channel.id === self.state.active_id ? 'active' : '';

            var msgCount = channel.total_msg_count - channelMember.msg_count;
            var titleClass = ''
            if (msgCount > 0 && channelMember.notify_level !== 'quiet') {
                titleClass = 'unread-title'
            }

            var badge = '';
            if (channelMember.mention_count > 0) {
                badge = <span className='badge pull-right small'>{channelMember.mention_count}</span>;
                badgesActive = true;
                titleClass = 'unread-title';
            }

            return (
                <li key={channel.id} className={active}><a className={'sidebar-channel ' + titleClass} href='#' onClick={function(e){e.preventDefault(); utils.switchChannel(channel);}}>{badge}{channel.display_name}</a></li>
            );
        });

        var directMessageItems = this.state.showDirectChannels.map(function(channel) {
            var badge = '';
            var titleClass = '';

            var statusIcon = '';
            if (channel.status === 'online') {
                statusIcon = Constants.ONLINE_ICON_SVG;
            } else if (channel.status === 'away') {
                statusIcon = Constants.ONLINE_ICON_SVG;
            } else {
                statusIcon = Constants.OFFLINE_ICON_SVG;
            }

            if (!channel.fake) {
                var active = channel.id === self.state.active_id ? 'active' : '';

                if (channel.unread) {
                    badge = <span className='badge pull-right small'>{channel.unread}</span>;
                    badgesActive = true;
                    titleClass = 'unread-title';
                }

                function handleClick(e) {
                    e.preventDefault();
                    utils.switchChannel(channel, channel.teammate_username);
                }

                return (
                    <li key={channel.name} className={active}><a className={'sidebar-channel ' + titleClass} href='#' onClick={handleClick}><span className='status' dangerouslySetInnerHTML={{__html: statusIcon}} /> {badge}{channel.display_name}</a></li>
                );
            } else {
                return (
                    <li key={channel.name} className={active}><a className={'sidebar-channel ' + titleClass} href={TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name}><span className='status' dangerouslySetInnerHTML={{__html: statusIcon}} /> {badge}{channel.display_name}</a></li>
                );
            }
        });

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

        if (channelItems.length == 0) {
            <li><small>Loading...</small></li>
        }

        if (privateChannelItems.length == 0) {
            <li><small>Loading...</small></li>
        }
        return (
            <div>
                <SidebarHeader teamDisplayName={this.props.teamDisplayName} teamType={this.props.teamType} />
                <SearchBox />

                <div className='nav-pills__container'>
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
                        { this.state.hideDirectChannels.length > 0 ?
                            <li><a href='#' data-toggle='modal' className='nav-more' data-target='#more_direct_channels' data-channels={JSON.stringify(this.state.hideDirectChannels)}>{'More ('+this.state.hideDirectChannels.length+')'}</a></li>
                        : '' }
                    </ul>
                </div>
            </div>
        );
    }
});
