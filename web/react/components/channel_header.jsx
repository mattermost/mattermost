// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var SocketStore = require('../stores/socket_store.jsx')
var UserProfile = require( './user_profile.jsx' );
var NavbarSearchBox =require('./search_bar.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');
var MessageWrapper = require('./message_wrapper.jsx');

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var PopoverListMembers = React.createClass({
    componentDidMount: function() {
        var originalLeave = $.fn.popover.Constructor.prototype.leave;
        $.fn.popover.Constructor.prototype.leave = function(obj) {
            var self = obj instanceof this.constructor ? obj : $(obj.currentTarget)[this.type](this.getDelegateOptions()).data('bs.' + this.type);
            originalLeave.call(this, obj);

            if (obj.currentTarget && self.$tip) {
                self.$tip.one('mouseenter', function() {
                    clearTimeout(self.timeout);
                    self.$tip.one('mouseleave', function() {
                        $.fn.popover.Constructor.prototype.leave.call(self, self);
                    });
                })
            }
        };

        $("#member_popover").popover({placement : 'bottom', trigger: 'click', html: true});
        $('body').on('click', function (e) {
            if ($(e.target.parentNode.parentNode)[0] !== $("#member_popover")[0] && $(e.target).parents('.popover.in').length === 0) {
                $("#member_popover").popover('hide');
            }
        });
    },

    render: function() {
        var popoverHtml = '';
        var members = this.props.members;
        var count = (members.length > 20) ? "20+" : (members.length || '-');

        if (members) {
            members.sort(function(a,b) {
                return a.username.localeCompare(b.username);
            });

            members.forEach(function(m) {
                popoverHtml += "<div class='text--nowrap'>" + m.username + "</div>";
            });
        }

        return (
            <div id="member_popover" data-toggle="popover" data-content={popoverHtml} data-original-title="Members" >
                <div id="member_tooltip" data-toggle="tooltip" title="View Channel Members">
                    {count} <span className="glyphicon glyphicon-user" aria-hidden="true"></span>
                </div>
            </div>
        );
    }
});

function getStateFromStores() {
  return {
    channel: ChannelStore.getCurrent(),
    memberChannel: ChannelStore.getCurrentMember(),
    memberTeam: UserStore.getCurrentUser(),
    users: ChannelStore.getCurrentExtraInfo().members,
    search_visible: PostStore.getSearchResults() != null
  };
}

module.exports = React.createClass({
    displayName: 'ChannelHeader',
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);
        ChannelStore.addExtraInfoChangeListener(this._onChange);
        PostStore.addSearchChangeListener(this._onChange);
        UserStore.addChangeListener(this._onChange);
        SocketStore.addChangeListener(this._onSocketChange);
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
        ChannelStore.removeExtraInfoChangeListener(this._onChange);
        PostStore.removeSearchChangeListener(this._onChange);
        UserStore.addChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
        $(".channel-header__info .description").popover({placement : 'bottom', trigger: 'hover', html: true, delay: {show: 500, hide: 500}});
    },
    _onSocketChange: function(msg) {
        if (msg.action === "new_user") {
            AsyncClient.getChannelExtraInfo(true);
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    handleLeave: function(e) {
        Client.leaveChannel(this.state.channel.id,
            function(data) {
                var townsquare = ChannelStore.getByName('town-square');
                utils.switchChannel(townsquare);
            },
            function(err) {
                AsyncClient.dispatchError(err, "handleLeave");
            }
        );
    },
    searchMentions: function(e) {
        e.preventDefault();

        var user = UserStore.getCurrentUser();

        var terms = "";
        if (user.notify_props && user.notify_props.mention_keys) {
            terms = UserStore.getCurrentMentionKeys().join(' ');
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: terms,
            do_search: true,
            is_mention_search: true
        });
    },

    render: function() {

        if (this.state.channel == null) {
            return null;
        }

        var channel = this.state.channel;
        var description = utils.textToJsx(channel.description, {"singleline": true, "noMentionHighlight": true});
        var popoverContent = React.renderToString(<MessageWrapper message={channel.description}/>);
        var channelTitle = channel.display_name;
        var currentId = UserStore.getCurrentId();
        var isAdmin = this.state.memberChannel.roles.indexOf("admin") > -1 || this.state.memberTeam.roles.indexOf("admin") > -1;
        var isDirect = (this.state.channel.type === 'D');

        if (isDirect) {
            if (this.state.users.length > 1) {
                var contact = this.state.users[((this.state.users[0].id === currentId) ? 1 : 0)];
                channelTitle = <UserProfile userId={contact.id} overwriteName={contact.full_name || contact.username} />;
            }
        }

        return (
            <table className="channel-header alt">
                <tr>
                    <th>
                        { !isDirect ?
                        <div className="channel-header__info">
                            <div className="dropdown">
                                <a href="#" className="dropdown-toggle theme" type="button" id="channel_header_dropdown" data-toggle="dropdown" aria-expanded="true">
                                    <strong className="heading">{channelTitle} </strong>
                                    <span className="glyphicon glyphicon-chevron-down header-dropdown__icon"></span>
                                </a>
                                <ul className="dropdown-menu" role="menu" aria-labelledby="channel_header_dropdown">
                                    <li role="presentation"><a role="menuitem" data-toggle="modal" data-target="#channel_info" data-channelid={channel.id} href="#">View Info</a></li>
                                    { !ChannelStore.isDefault(channel) ?
                                        <li role="presentation"><a role="menuitem" data-toggle="modal" data-target="#channel_invite" href="#">Add Members</a></li>
                                        : null
                                    }
                                    { isAdmin && !ChannelStore.isDefault(channel) ?
                                        <li role="presentation"><a role="menuitem" data-toggle="modal" data-target="#channel_members" href="#">Manage Members</a></li>
                                        : null
                                    }
                                    <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#edit_channel" data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id}>Set Channel Description...</a></li>
                                    <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#channel_notifications" data-title={channel.display_name} data-channelid={channel.id}>Notification Preferences</a></li>
                                    { isAdmin && !ChannelStore.isDefault(channel) ?
                                        <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#rename_channel" data-display={channel.display_name} data-name={channel.name} data-channelid={channel.id}>Rename Channel...</a></li>
                                        : null
                                    }
                                    { isAdmin && !ChannelStore.isDefault(channel) ?
                                        <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#delete_channel" data-title={channel.display_name} data-channelid={channel.id}>Delete Channel...</a></li>
                                        : null
                                    }
                                    { !ChannelStore.isDefault(channel) ?
                                        <li role="presentation"><a role="menuitem" href="#" onClick={this.handleLeave}>Leave Channel</a></li>
                                        : null
                                    }
                                </ul>
                            </div>
                            <div data-toggle="popover" data-content={popoverContent} className="description">{description}</div>
                        </div>
                    :
                        <a href="#"><strong className="heading">{channelTitle}</strong></a>
                    }
                    </th>
                    <th><PopoverListMembers members={this.state.users} channelId={channel.id} /></th>
                    <th className="search-bar__container"><NavbarSearchBox /></th>
                    <th>
                        <div className="dropdown channel-header__links">
                            <a href="#" className="dropdown-toggle theme" type="button" id="channel_header_right_dropdown" data-toggle="dropdown" aria-expanded="true">
                                <span dangerouslySetInnerHTML={{__html: " <svg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'width='4px' height='16px' viewBox='0 0 8 32' enable-background='new 0 0 8 32' xml:space='preserve'> <g> <circle cx='4' cy='4.062' r='4'/> <circle cx='4' cy='16' r='4'/> <circle cx='4' cy='28' r='4'/> </g> </svg>"}} /> </a>
                            <ul className="dropdown-menu dropdown-menu-right" role="menu" aria-labelledby="channel_header_right_dropdown">
                                <li role="presentation"><a role="menuitem" href="#" onClick={this.searchMentions}>Recent Mentions</a></li>
                            </ul>
                        </div>
                    </th>
                </tr>
            </table>
        );
    }
});
