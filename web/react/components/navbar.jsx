// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Sidebar = require('./sidebar.jsx');
var UserStore = require('../stores/user_store.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var Constants = require('../utils/constants.jsx');
var UserProfile = require('./user_profile.jsx');
var MessageWrapper = require('./message_wrapper.jsx');
var ActionTypes = Constants.ActionTypes;

function getCountsStateFromStores() {

    var count = 0;
    var channels = ChannelStore.getAll();
    var members = ChannelStore.getAllMembers();

    channels.forEach(function(channel) {
        var channelMember = members[channel.id];
        if (channel.type === 'D') {
            count += channel.total_msg_count - channelMember.msg_count;
        } else {
            if (channelMember.mention_count > 0) {
                count += channelMember.mention_count;
            } else if (channel.total_msg_count - channelMember.msg_count > 0) {
                count += 1;
            }
        }
    });

    return { count: count }
}

var NotifyCounts =  React.createClass({
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getCountsStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    },
    getInitialState: function() {
        return getCountsStateFromStores();
    },
    render: function() {
        if (this.state.count == 0) {
            return (<span></span>);
        }
        else {
            return (<span className="badge badge-notify">{ this.state.count }</span>);
        }
    }
});

var NavbarLoginForm = React.createClass({
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
            <form className="navbar-form navbar-right" onSubmit={this.handleSubmit}>
                <a href="/find_team">Find your team</a>
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
  return {
    channel: ChannelStore.getCurrent(),
    member: ChannelStore.getCurrentMember(),
    users: ChannelStore.getCurrentExtraInfo().members
  };
}

module.exports = React.createClass({
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);
        ChannelStore.addExtraInfoChangeListener(this._onChange);
        var self = this;
        $('.inner__wrap').click(self.hideSidebars);

        $('body').on('click.infopopover', function(e){
            if ($(e.target).attr('data-toggle') !== 'popover'
                && $(e.target).parents('.popover.in').length === 0) {
                $('.info-popover').popover('hide');
            }
        });

    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
    },
    handleSubmit: function(e) {
        e.preventDefault();
    },
    handleLeave: function(e) {
        client.leaveChannel(this.state.channel.id,
            function(data) {
                AsyncClient.getChannels(true);
                window.location.href = '/channels/town-square';
            }.bind(this),
            function(err) {
                AsyncClient.dispatchError(err, "handleLeave");
            }.bind(this)
        );
    },
    hideSidebars: function(e) {
        var windowWidth = $(window).outerWidth();
        if(windowWidth <= 768) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_SEARCH,
                results: null
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_POST_SELECTED,
                results: null
            });

            if (e.target.className != 'navbar-toggle' && e.target.className != 'icon-bar') {
                $('.inner__wrap').removeClass('move--right').removeClass('move--left').removeClass('move--left-small');
                $('.sidebar--left').removeClass('move--right');
                $('.sidebar--right').removeClass('move--left');
                $('.sidebar--menu').removeClass('move--left');
            }
        }
    },
    toggleLeftSidebar: function() {
        $('.inner__wrap').toggleClass('move--right');
        $('.sidebar--left').toggleClass('move--right');
    },
    toggleRightSidebar: function() {
        $('.inner__wrap').toggleClass('move--left-small');
        $('.sidebar--menu').toggleClass('move--left');
    },
    _onChange: function() {
        this.setState(getStateFromStores());
        $("#navbar .navbar-brand .description").popover({placement : 'bottom', trigger: 'click', html: true});
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {

        var currentId = UserStore.getCurrentId();
        var channelName = "";
        var popoverContent = "";
        var channelTitle = this.props.teamName;
        var isAdmin = false;
        var isDirect = false;
        var description = ""

        if (this.state.channel) {
            var channel = this.state.channel;
            description = utils.textToJsx(this.state.channel.description, {"singleline": true, "noMentionHighlight": true});
            popoverContent = React.renderToString(<MessageWrapper message={this.state.channel.description}/>);
            channelName = this.state.channel.name;
            isAdmin = this.state.member.roles.indexOf("admin") > -1;

            if (channel.type === 'O') {
                channelTitle = this.state.channel.display_name;
            } else if (channel.type === 'P') {
                channelTitle = this.state.channel.display_name;
            } else if (channel.type === 'D') {
                isDirect = true;
                if (this.state.users.length > 1) {
                    if (this.state.users[0].id === currentId) {
                        channelTitle = <UserProfile userId={this.state.users[1].id} />;
                    } else {
                        channelTitle = <UserProfile userId={this.state.users[0].id} />;
                    }
                }
            }

            if(this.state.channel.description.length == 0){
                popoverContent = React.renderToString(<div>No channel description yet. <br /><a href='#' data-toggle='modal' data-desc={this.state.channel.description} data-title={this.state.channel.display_name} data-channelid={this.state.channel.id} data-target='#edit_channel'>Click here</a> to add one.</div>);
            }
        }

        var loginForm = currentId == null ? <NavbarLoginForm /> : null;
        var navbar_collapse_button = currentId != null ? null :
                        <button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#navbar-collapse-1">
                            <span className="sr-only">Toggle sidebar</span>
                            <span className="icon-bar"></span>
                            <span className="icon-bar"></span>
                            <span className="icon-bar"></span>
                        </button>;
        var sidebar_collapse_button = currentId == null ? null :
                        <button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#sidebar-nav" onClick={this.toggleLeftSidebar}>
                            <span className="sr-only">Toggle sidebar</span>
                            <span className="icon-bar"></span>
                            <span className="icon-bar"></span>
                            <span className="icon-bar"></span>
                            <NotifyCounts />
                        </button>;
        var right_sidebar_collapse_button= currentId == null ? null :
                        <button type="button" className="navbar-toggle menu-toggle pull-right" data-toggle="collapse" data-target="#sidebar-nav" onClick={this.toggleRightSidebar}>
                            <span className="dropdown__icon"></span>
                        </button>;


        return (
            <nav className="navbar navbar-default navbar-fixed-top" role="navigation">
                <div className="container-fluid theme">
                    <div className="navbar-header">
                        { navbar_collapse_button }
                        { sidebar_collapse_button }
                        { right_sidebar_collapse_button }
                    { !isDirect && this.state.channel ?
                        <div className="navbar-brand">
                            <div className="dropdown">
                                <div data-toggle="popover" data-content={popoverContent} className="description info-popover"></div>
                                <a href="#" className="dropdown-toggle theme" type="button" id="channel_header_dropdown" data-toggle="dropdown" aria-expanded="true">
                                    <strong className="heading">{channelTitle} </strong>
                                    <span className="glyphicon glyphicon-chevron-down header-dropdown__icon"></span>
                                </a>
                                <ul className="dropdown-menu" role="menu" aria-labelledby="channel_header_dropdown">
                                    <li role="presentation"><a role="menuitem" data-toggle="modal" data-target="#channel_invite" href="#">Invite Members</a></li>
                                    { isAdmin ?
                                        <li role="presentation"><a role="menuitem" data-toggle="modal" data-target="#channel_members" href="#">Manage Members</a></li>
                                        : ""
                                    }
                                    <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#edit_channel" data-desc={this.state.channel.description} data-title={this.state.channel.display_name} data-channelid={this.state.channel.id}>Set Channel Description...</a></li>
                                    <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#channel_notifications" data-title={this.state.channel.display_name} data-channelid={this.state.channel.id}>Notification Preferences</a></li>
                                    { isAdmin && channelName != Constants.DEFAULT_CHANNEL ?
                                        <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#rename_channel" data-display={this.state.channel.display_name} data-name={this.state.channel.name} data-channelid={this.state.channel.id}>Rename Channel...</a></li>
                                        : ""
                                    }
                                    { isAdmin && channelName != Constants.DEFAULT_CHANNEL ?
                                        <li role="presentation"><a role="menuitem" href="#" data-toggle="modal" data-target="#delete_channel" data-title={this.state.channel.display_name} data-channelid={this.state.channel.id}>Delete Channel...</a></li>
                                        : ""
                                    }
                                    { channelName != Constants.DEFAULT_CHANNEL ?
                                        <li role="presentation"><a role="menuitem" href="#" onClick={this.handleLeave}>Leave Channel</a></li>
                                        : ""
                                    }
                                </ul>
                            </div>
                        </div>
                        : "" }
                        { isDirect && this.state.channel ?
                            <div className="navbar-brand">
                                <strong>
                                    <a href="#"><strong className="heading">{channelTitle}</strong></a>
                                </strong>
                            </div>
                        : "" }
                        { !this.state.channel ?
                            <div className="navbar-brand">
                                <strong>
                                    <a href="/"><strong className="heading">{ channelTitle }</strong></a>
                                </strong>
                            </div>
                        : "" }
                    </div>
                    <div className="collapse navbar-collapse" id="navbar-collapse-1">
                        { loginForm }
                    </div>
                </div>
            </nav>
        );
}
});


