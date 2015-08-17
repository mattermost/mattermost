// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var TeamStore = require('../stores/team_store.jsx');

var UserProfile = require('./user_profile.jsx');
var MessageWrapper = require('./message_wrapper.jsx');
var NotifyCounts = require('./notify_counts.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');

function getStateFromStores() {
    return {
        channel: ChannelStore.getCurrent(),
        member: ChannelStore.getCurrentMember(),
        users: ChannelStore.getCurrentExtraInfo().members
    };
}

module.exports = React.createClass({
    displayName: 'Navbar',
    propTypes: {
        teamDisplayName: React.PropTypes.string
    },
    componentDidMount: function() {
        ChannelStore.addChangeListener(this.onListenerChange);
        ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
        $('.inner__wrap').click(this.hideSidebars);

        $('body').on('click.infopopover', function handlePopoverClick(e) {
            if ($(e.target).attr('data-toggle') !== 'popover' && $(e.target).parents('.popover.in').length === 0) {
                $('.info-popover').popover('hide');
            }
        });
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this.onListenerChange);
    },
    handleSubmit: function(e) {
        e.preventDefault();
    },
    handleLeave: function() {
        client.leaveChannel(this.state.channel.id,
            function success() {
                AsyncClient.getChannels(true);
                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/town-square';
            },
            function error(err) {
                AsyncClient.dispatchError(err, 'handleLeave');
            }
        );
    },
    hideSidebars: function(e) {
        var windowWidth = $(window).outerWidth();
        if (windowWidth <= 768) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_SEARCH,
                results: null
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_POST_SELECTED,
                results: null
            });

            if (e.target.className !== 'navbar-toggle' && e.target.className !== 'icon-bar') {
                $('.inner__wrap').removeClass('move--right move--left move--left-small');
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
    onListenerChange: function() {
        this.setState(getStateFromStores());
        $('#navbar .navbar-brand .description').popover({placement: 'bottom', trigger: 'click', html: true});
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var currentId = UserStore.getCurrentId();
        var popoverContent = '';
        var channelTitle = this.props.teamDisplayName;
        var isAdmin = false;
        var isDirect = false;
        var channel = this.state.channel;

        if (channel) {
            popoverContent = React.renderToString(<MessageWrapper message={channel.description} options={{singleline: true, noMentionHighlight: true}}/>);
            isAdmin = this.state.member.roles.indexOf('admin') > -1;

            if (channel.type === 'O') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'P') {
                channelTitle = channel.display_name;
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

            if (channel.description.length === 0) {
                popoverContent = React.renderToString(<div>No channel description yet. <br /><a href='#' data-toggle='modal' data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id} data-target='#edit_channel'>Click here</a> to add one.</div>);
            }
        }

        var navbarCollapseButton = null;
        if (currentId == null) {
            navbarCollapseButton = (<button type='button' className='navbar-toggle' data-toggle='collapse' data-target='#navbar-collapse-1'>
                                        <span className='sr-only'>Toggle sidebar</span>
                                        <span className='icon-bar'></span>
                                        <span className='icon-bar'></span>
                                        <span className='icon-bar'></span>
                                    </button>);
        }

        var sidebarCollapseButton = null;
        if (currentId != null) {
            sidebarCollapseButton = (<button type='button' className='navbar-toggle' data-toggle='collapse' data-target='#sidebar-nav' onClick={this.toggleLeftSidebar}>
                                        <span className='sr-only'>Toggle sidebar</span>
                                        <span className='icon-bar'></span>
                                        <span className='icon-bar'></span>
                                        <span className='icon-bar'></span>
                                        <NotifyCounts />
                                    </button>);
        }

        var rightSidebarCollapseButton = null;
        if (currentId != null) {
            rightSidebarCollapseButton = (<button type='button' className='navbar-toggle menu-toggle pull-right' data-toggle='collapse' data-target='#sidebar-nav' onClick={this.toggleRightSidebar}>
                                            <span dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}} />
                                        </button>);
        }

        var channelMenuDropdown = null;
        if (!isDirect && channel) {
            var addMembersOption = null;
            if (!ChannelStore.isDefault(channel)) {
                addMembersOption = <li role='presentation'><a role='menuitem' data-toggle='modal' data-target='#channel_invite' href='#'>Add Members</a></li>;
            }

            var manageMembersOption = null;
            if (isAdmin && !ChannelStore.isDefault(channel)) {
                manageMembersOption = <li role='presentation'><a role='menuitem' data-toggle='modal' data-target='#channel_members' href='#'>Manage Members</a></li>;
            }

            var setChannelDescriptionOption = <li role='presentation'><a role='menuitem' href='#' data-toggle='modal' data-target='#edit_channel' data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id}>Set Channel Description...</a></li>;
            var notificationPreferenceOption = <li role='presentation'><a role='menuitem' href='#' data-toggle='modal' data-target='#channel_notifications' data-title={channel.display_name} data-channelid={channel.id}>Notification Preferences</a></li>;

            var renameChannelOption = null;
            if (isAdmin && !ChannelStore.isDefault(channel)) {
                renameChannelOption = <li role='presentation'><a role='menuitem' href='#' data-toggle='modal' data-target='#rename_channel' data-display={channel.display_name} data-name={channel.name} data-channelid={channel.id}>Rename Channel...</a></li>;
            }

            var deleteChannelOption = null;
            if (isAdmin && !ChannelStore.isDefault(channel)) {
                deleteChannelOption = <li role='presentation'><a role='menuitem' href='#' data-toggle='modal' data-target='#delete_channel' data-title={channel.display_name} data-channelid={channel.id}>Delete Channel...</a></li>;
            }

            var leaveChannelOption = null;
            if (!ChannelStore.isDefault(channel)) {
                leaveChannelOption = <li role='presentation'><a role='menuitem' href='#' onClick={this.handleLeave}>Leave Channel</a></li>;
            }

            channelMenuDropdown = (<div className='navbar-brand'>
                                        <div className='dropdown'>
                                            <div data-toggle='popover' data-content={popoverContent} className='description info-popover'></div>
                                            <a href='#' className='dropdown-toggle theme' type='button' id='channel_header_dropdown' data-toggle='dropdown' aria-expanded='true'>
                                                <span className='heading'>{channelTitle} </span>
                                                <span className='glyphicon glyphicon-chevron-down header-dropdown__icon'></span>
                                            </a>
                                            <ul className='dropdown-menu' role='menu' aria-labelledby='channel_header_dropdown'>
                                                {addMembersOption}
                                                {manageMembersOption}
                                                {setChannelDescriptionOption}
                                                {notificationPreferenceOption}
                                                {renameChannelOption}
                                                {deleteChannelOption}
                                                {leaveChannelOption}
                                            </ul>
                                        </div>
                                    </div>);
        } else if (isDirect && channel) {
            channelMenuDropdown = (<div className='navbar-brand'>
                                        <a href='#' className='heading'>{channelTitle}</a>
                                    </div>);
        } else if (!channel) {
            channelMenuDropdown = (<div className='navbar-brand'>
                                        <a href='/' className='heading'>{channelTitle}</a>
                                    </div>);
        }

        return (
            <nav className='navbar navbar-default navbar-fixed-top' role='navigation'>
                <div className='container-fluid theme'>
                    <div className='navbar-header'>
                        {navbarCollapseButton}
                        {sidebarCollapseButton}
                        {rightSidebarCollapseButton}
                        {channelMenuDropdown}
                    </div>
                </div>
            </nav>
        );
    }
});
