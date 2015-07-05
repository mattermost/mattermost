// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var SidebarHeader = require('./sidebar_header.jsx');
var SearchBox = require('./search_bar.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var SidebarLoginForm = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();
        var state = { }

        var domain = this.refs.domain.getDOMNode().value.trim();
        if (!domain) {
            state.server_error = "A domain is required"
            this.setState(state);
            return;
        }

       var email = this.refs.email.getDOMNode().value.trim();
        if (!email) {
            state.server_error = "An email is required"
            this.setState(state);
            return;
        }

        var password = this.refs.password.getDOMNode().value.trim();
        if (!password) {
            state.server_error = "A password is required"
            this.setState(state);
            return;
        }

        state.server_error = "";
        this.setState(state);

        client.loginByEmail(domain, email, password,
            function(data) {
                UserStore.setLastDomain(domain);
                UserStore.setLastEmail(email);
                UserStore.setCurrentUser(data);

                var redirect = utils.getUrlParameter("redirect");
                if (redirect) {
                    window.location.href = decodeURI(redirect);
                } else {
                    window.location.href = '/channels/town-square';
                }

            }.bind(this),
            function(err) {
                if (err.message == "Login failed because email address has not been verified") {
                    window.location.href = '/verify?domain=' + encodeURIComponent(domain) + '&email=' + encodeURIComponent(email);
                    return;
                }
                state.server_error = err.message;
                this.valid = false;
                this.setState(state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var server_error = this.state.server_error ? <label className="control-label">{this.state.server_error}</label> : null;

        var subDomain = utils.getSubDomain();
        var subDomainClass = "form-control hidden";

        if (subDomain == "") {
            subDomain = UserStore.getLastDomain();
            subDomainClass = "form-control";
        }

        return (
            <form className="" onSubmit={this.handleSubmit}>
                <a href="/find_team">{"Find your " + strings.Team}</a>
                <div className={server_error ? 'form-group has-error' : 'form-group'}>
                    { server_error }
                    <input type="text" className={subDomainClass} name="domain" defaultValue={subDomain} ref="domain" placeholder="Domain" />
                </div>
                <div className={server_error ? 'form-group has-error' : 'form-group'}>
                    <input type="text" className="form-control" name="email" defaultValue={UserStore.getLastEmail()}  ref="email" placeholder="Email" />
                </div>
                <div className={server_error ? 'form-group has-error' : 'form-group'}>
                    <input type="password" className="form-control" name="password" ref="password" placeholder="Password" />
                </div>
                <button type="submit" className="btn btn-default">Login</button>
            </form>
        );
    }
});

function getStateFromStores() {
    var members = ChannelStore.getAllMembers();
    var team_member_map = UserStore.getActiveOnlyProfiles();
    var current_id = ChannelStore.getCurrentId();

    var teammates = [];
    for (var id in team_member_map) {
        if (id === UserStore.getCurrentId()) continue;
        teammates.push(team_member_map[id]);
    }

    // Create lists of all read and unread direct channels
    var showDirectChannels = [];
    var readDirectChannels = [];
    for (var i = 0; i < teammates.length; i++) {
        var teammate = teammates[i];

        if (teammate.id == UserStore.getCurrentId()) {
            continue;
        }

        var channelName = "";
        if (teammate.id > UserStore.getCurrentId()) {
            channelName = UserStore.getCurrentId() + '__' + teammate.id;
        } else {
            channelName = teammate.id + '__' + UserStore.getCurrentId();
        }

        var channel = ChannelStore.getByName(channelName);

        if (channel != null) {
            channel.display_name = teammate.full_name.trim() != "" ? teammate.full_name : teammate.username;
            channel.teammate_username = teammate.username;

            channel.status = UserStore.getStatus(teammate.id);

            var channelMember = members[channel.id];
            var msg_count = channel.total_msg_count - channelMember.msg_count;
            if (msg_count > 0) {
                channel.unread = msg_count;
                showDirectChannels.push(channel);
            } else if (current_id === channel.id) {
                showDirectChannels.push(channel);
            } else {
                readDirectChannels.push(channel);
            }
        } else {
            var tempChannel = {};
            tempChannel.fake = true;
            tempChannel.name = channelName;
            tempChannel.display_name = teammate.full_name.trim() != "" ? teammate.full_name : teammate.username;
            tempChannel.status = UserStore.getStatus(teammate.id);
            tempChannel.last_post_at = 0;
            readDirectChannels.push(tempChannel);
        }
    }

    // If we don't have MAX_DMS unread channels, sort the read list by last_post_at
    if (showDirectChannels.length < Constants.MAX_DMS) {
        readDirectChannels.sort(function(a,b) {
            // sort by last_post_at first
            if (a.last_post_at > b.last_post_at) return -1;
            if (a.last_post_at < b.last_post_at) return 1;
            // if last_post_at is equal, sort by name
            if (a.display_name < b.display_name) return -1;
            if (a.display_name > b.display_name) return 1;
            return 0;
        });

        var index = 0;
        while (showDirectChannels.length < Constants.MAX_DMS && index < readDirectChannels.length) {
            showDirectChannels.push(readDirectChannels[index]);
            index++;
        }
        readDirectChannels = readDirectChannels.slice(index);

        showDirectChannels.sort(function(a,b) {
            if (a.display_name < b.display_name) return -1;
            if (a.display_name > b.display_name) return 1;
            return 0;
        });
    }

    return {
        active_id: current_id,
        channels: ChannelStore.getAll(),
        members: members,
        showDirectChannels: showDirectChannels,
        hideDirectChannels: readDirectChannels
    };
}

var SidebarLoggedIn = React.createClass({
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);
        UserStore.addChangeListener(this._onChange);
        UserStore.addStatusesChangeListener(this._onChange);
        SocketStore.addChangeListener(this._onSocketChange);
        $(".nav-pills__container").perfectScrollbar();

        this.updateTitle();
    },
    componentDidUpdate: function() {
        this.updateTitle();
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
        UserStore.removeChangeListener(this._onChange);
        UserStore.removeStatusesChangeListener(this._onChange);
        SocketStore.removeChangeListener(this._onSocketChange);
    },
    _onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    _onSocketChange: function(msg) {
        if (msg.action == "posted") {
            if (ChannelStore.getCurrentId() === msg.channel_id) {
                AsyncClient.getChannels(true, window.isActive);
            } else {
                AsyncClient.getChannels(true);
            }

            if (UserStore.getCurrentId() != msg.user_id) {

                var mentions = msg.props.mentions ? JSON.parse(msg.props.mentions) : [];
                var channel = ChannelStore.get(msg.channel_id);

                var user = UserStore.getCurrentUser();
                if (user.notify_props && ((user.notify_props.desktop === "mention" && mentions.indexOf(user.id) === -1 && channel.type !== 'D') || user.notify_props.desktop === "none")) {
                    return;
                }

                var member = ChannelStore.getMember(msg.channel_id);
                if ((member.notify_level === "mention" && mentions.indexOf(user.id) === -1) || member.notify_level === "none" || member.notify_level === "quiet") {
                    return;
                }

                var username = "Someone";
                if (UserStore.hasProfile(msg.user_id)) {
                    username = UserStore.getProfile(msg.user_id).username;
                }

                var title = channel ? channel.display_name : "Posted";

                var repRegex = new RegExp("<br>", "g");
                var post = JSON.parse(msg.props.post);
                var msg = post.message.replace(repRegex, "\n").split("\n")[0].replace("<mention>", "").replace("</mention>", "");
                if (msg.length > 50) {
                    msg = msg.substring(0,49) + "...";
                }
                utils.notifyMe(title, username + " wrote: " + msg, channel);
                if (!user.notify_props || user.notify_props.desktop_sound === "true") {
                    utils.ding();
                }
            }

        } else if (msg.action == "viewed") {
            if (ChannelStore.getCurrentId() != msg.channel_id) {
                AsyncClient.getChannels(true);
            }
        }
    },
    updateTitle: function() {
        var channel = ChannelStore.getCurrent();
        if (channel) {
            if (channel.type === 'D') {
                var teammate_username = utils.getDirectTeammate(channel.id).username
                document.title = teammate_username + " " + document.title.substring(document.title.lastIndexOf("-"));
            } else {
                document.title = channel.display_name + " " + document.title.substring(document.title.lastIndexOf("-"))
            }
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var members = this.state.members;
        var newsActive = window.location.pathname === "/" ? "active" : "";
        var badgesActive = false;
        var self = this;
        var channelItems = this.state.channels.map(function(channel) {
            if (channel.type != 'O') {
                return "";
            }

            var channelMember = members[channel.id];
            var active = channel.id === self.state.active_id ? "active" : "";

            var msg_count = channel.total_msg_count - channelMember.msg_count;
            var titleClass = ""
            if (msg_count > 0 && channelMember.notify_level !== "quiet") {
                titleClass = "unread-title"
            }

            var badge = "";
            if (channelMember.mention_count > 0) {
                badge = <span className="badge pull-right small">{channelMember.mention_count}</span>;
                badgesActive = true;
                titleClass = "unread-title"
            }

            return (
                <li key={channel.id} className={active}><a className={"sidebar-channel " + titleClass} href="#" onClick={function(e){e.preventDefault(); utils.switchChannel(channel);}}>{badge}{channel.display_name}</a></li>
            );
        });

        var privateChannelItems = this.state.channels.map(function(channel) {
            if (channel.type != 'P') {
                return "";
            }

            var channelMember = members[channel.id];
            var active = channel.id === self.state.active_id ? "active" : "";

            var msg_count = channel.total_msg_count - channelMember.msg_count;
            var titleClass = ""
            if (msg_count > 0 && channelMember.notify_level !== "quiet") {
                titleClass = "unread-title"
            }

            var badge = "";
            if (channelMember.mention_count > 0) {
                badge = <span className="badge pull-right small">{channelMember.mention_count}</span>;
                badgesActive = true;
                titleClass = "unread-title"
            }

            return (
                <li key={channel.id} className={active}><a className={"sidebar-channel " + titleClass} href="#" onClick={function(e){e.preventDefault(); utils.switchChannel(channel);}}>{badge}{channel.display_name}</a></li>
            );
        });

        var directMessageItems = this.state.showDirectChannels.map(function(channel) {
            var badge = "";
            var titleClass = "";

            var statusIcon = "";
            if (channel.status === "online") {
                statusIcon = Constants.ONLINE_ICON_SVG;
            } else if (channel.status === "away") {
                statusIcon = Constants.ONLINE_ICON_SVG;
            } else {
                statusIcon = Constants.OFFLINE_ICON_SVG;
            }

            if (!channel.fake) {
                var active = channel.id === self.state.active_id ? "active" : "";

                if (channel.unread) {
                    badge = <span className="badge pull-right small">{channel.unread}</span>;
                    badgesActive = true;
                    titleClass = "unread-title"
                }

                return (
                    <li key={channel.name} className={active}><a className={"sidebar-channel " + titleClass} href="#" onClick={function(e){e.preventDefault(); utils.switchChannel(channel, channel.teammate_username);}}><span className="status" dangerouslySetInnerHTML={{__html: statusIcon}} /> {badge}{channel.display_name}</a></li>
                );
            } else {
                return (
                    <li key={channel.name} className={active}><a className={"sidebar-channel " + titleClass} href={"/channels/"+channel.name}><span className="status" dangerouslySetInnerHTML={{__html: statusIcon}} /> {badge}{channel.display_name}</a></li>
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
                <SidebarHeader teamName={this.props.teamName} teamType={this.props.teamType} />
                <SearchBox />

                <div className="nav-pills__container">
                    <ul className="nav nav-pills nav-stacked">
                        <li><h4>Channels<a className="add-channel-btn" href="#" data-toggle="modal" data-target="#new_channel" data-channeltype="O">+</a></h4></li>
                        {channelItems}
                        <li><a href="#" data-toggle="modal" className="nav-more" data-target="#more_channels" data-channeltype="O">More...</a></li>
                    </ul>

                    <ul className="nav nav-pills nav-stacked">
                        <li><h4>Private Groups<a className="add-channel-btn" href="#" data-toggle="modal" data-target="#new_channel" data-channeltype="P">+</a></h4></li>
                        {privateChannelItems}
                    </ul>
                    <ul className="nav nav-pills nav-stacked">
                        <li><h4>Private Messages</h4></li>
                        {directMessageItems}
                        { this.state.hideDirectChannels.length > 0 ?
                            <li><a href="#" data-toggle="modal" className="nav-more" data-target="#more_direct_channels" data-channels={JSON.stringify(this.state.hideDirectChannels)}>{"More ("+this.state.hideDirectChannels.length+")"}</a></li>
                        : "" }
                    </ul>
                </div>
            </div>
        );
    }
});

var SidebarLoggedOut = React.createClass({
    render: function() {
        return (
            <div>
                <SidebarHeader teamName={this.props.teamName} />
                <SidebarLoginForm />
            </div>
        );
    }
});

module.exports = React.createClass({
    render: function() {
        var currentId = UserStore.getCurrentId();
        if (currentId != null) {
            return <SidebarLoggedIn teamName={this.props.teamName} teamType={this.props.teamType} />;
        } else {
            return <SidebarLoggedOut teamName={this.props.teamName} />;
        }
    }
});
