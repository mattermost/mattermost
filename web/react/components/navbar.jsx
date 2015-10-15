// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var MessageWrapper = require('./message_wrapper.jsx');
var NotifyCounts = require('./notify_counts.jsx');
const Utils = require('../utils/utils.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Popover = ReactBootstrap.Popover;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class Navbar extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.createCollapseButtons = this.createCollapseButtons.bind(this);
        this.createDropdown = this.createDropdown.bind(this);

        this.state = this.getStateFromStores();
    }
    getStateFromStores() {
        return {
            channel: ChannelStore.getCurrent(),
            member: ChannelStore.getCurrentMember(),
            users: ChannelStore.getCurrentExtraInfo().members
        };
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        ChannelStore.addExtraInfoChangeListener(this.onChange);
        $('.inner__wrap').click(this.hideSidebars);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
    }
    handleSubmit(e) {
        e.preventDefault();
    }
    handleLeave() {
        Client.leaveChannel(this.state.channel.id,
            function success() {
                AsyncClient.getChannels(true);
                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/town-square';
            },
            function error(err) {
                AsyncClient.dispatchError(err, 'handleLeave');
            }
        );
    }
    hideSidebars(e) {
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
    }
    toggleLeftSidebar() {
        $('.inner__wrap').toggleClass('move--right');
        $('.sidebar--left').toggleClass('move--right');
    }
    toggleRightSidebar() {
        $('.inner__wrap').toggleClass('move--left-small');
        $('.sidebar--menu').toggleClass('move--left');
    }
    onChange() {
        this.setState(this.getStateFromStores());
        $('#navbar .navbar-brand .description').popover({placement: 'bottom', trigger: 'click', html: true});
    }
    createDropdown(channel, channelTitle, isAdmin, isDirect, popoverContent) {
        if (channel) {
            var viewInfoOption = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#channel_info'
                        data-channelid={channel.id}
                        href='#'
                    >
                        View Info
                    </a>
                </li>
            );

            var setChannelDescriptionOption = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        data-toggle='modal'
                        data-target='#edit_channel'
                        data-desc={channel.description}
                        data-title={channel.display_name}
                        data-channelid={channel.id}
                    >
                        Set Channel Description...
                    </a>
                </li>
            );

            var addMembersOption;
            var leaveChannelOption;
            if (!isDirect && !ChannelStore.isDefault(channel)) {
                addMembersOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            data-toggle='modal'
                            data-target='#channel_invite'
                            href='#'
                        >
                            Add Members
                        </a>
                    </li>
                );

                leaveChannelOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.handleLeave}
                        >
                            Leave Channel
                        </a>
                    </li>
                );
            }

            var manageMembersOption;
            var renameChannelOption;
            var deleteChannelOption;
            if (!isDirect && isAdmin && !ChannelStore.isDefault(channel)) {
                manageMembersOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            data-toggle='modal'
                            data-target='#channel_members'
                            href='#'
                        >
                            Manage Members
                        </a>
                    </li>
                );

                renameChannelOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            data-toggle='modal'
                            data-target='#rename_channel'
                            data-display={channel.display_name}
                            data-name={channel.name}
                            data-channelid={channel.id}
                        >
                            Rename Channel...
                        </a>
                    </li>
                );

                deleteChannelOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            data-toggle='modal'
                            data-target='#delete_channel'
                            data-title={channel.display_name}
                            data-channelid={channel.id}
                        >
                            Delete Channel...
                        </a>
                    </li>
                );
            }

            var notificationPreferenceOption;
            if (!isDirect) {
                notificationPreferenceOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            data-toggle='modal'
                            data-target='#channel_notifications'
                            data-title={channel.display_name}
                            data-channelid={channel.id}
                        >
                            Notification Preferences
                        </a>
                    </li>
                );
            }

            return (
                <div className='navbar-brand'>
                    <div className='dropdown'>
                        <OverlayTrigger
                            trigger='click'
                            placement='bottom'
                            rootClose='true'
                            overlay={<Popover>{popoverContent}</Popover>}
                        >
                        <div className='description info-popover'/>
                        </OverlayTrigger>
                        <a
                            href='#'
                            className='dropdown-toggle theme'
                            type='button'
                            id='channel_header_dropdown'
                            data-toggle='dropdown'
                            aria-expanded='true'
                        >
                            <span className='heading'>{channelTitle} </span>
                            <span className='glyphicon glyphicon-chevron-down header-dropdown__icon'></span>
                        </a>
                        <ul
                            className='dropdown-menu'
                            role='menu'
                            aria-labelledby='channel_header_dropdown'
                        >
                            {viewInfoOption}
                            {addMembersOption}
                            {manageMembersOption}
                            {setChannelDescriptionOption}
                            {notificationPreferenceOption}
                            {renameChannelOption}
                            {deleteChannelOption}
                            {leaveChannelOption}
                        </ul>
                    </div>
                </div>
            );
        }

        return (
            <div className='navbar-brand'>
                <a
                    href={TeamStore.getCurrentTeamUrl() + '/channels/town-square'}
                    className='heading'
                >
                    {channelTitle}
                </a>
            </div>
        );
    }
    createCollapseButtons(currentId) {
        var buttons = [];
        if (currentId == null) {
            buttons.push(
                <button
                    key='navbar-toggle-collapse'
                    type='button'
                    className='navbar-toggle'
                    data-toggle='collapse'
                    data-target='#navbar-collapse-1'
                >
                    <span className='sr-only'>Toggle sidebar</span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                </button>
            );
        } else {
            buttons.push(
                <button
                    key='navbar-toggle-sidebar'
                    type='button'
                    className='navbar-toggle'
                    data-toggle='collapse'
                    data-target='#sidebar-nav'
                    onClick={this.toggleLeftSidebar}
                >
                    <span className='sr-only'>Toggle sidebar</span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                    <NotifyCounts />
                </button>
            );

            buttons.push(
                <button
                    key='navbar-toggle-menu'
                    type='button'
                    className='navbar-toggle menu-toggle pull-right'
                    data-toggle='collapse'
                    data-target='#sidebar-nav'
                    onClick={this.toggleRightSidebar}
                >
                    <span dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}} />
                </button>
            );
        }

        return buttons;
    }
    render() {
        var currentId = UserStore.getCurrentId();
        var channel = this.state.channel;
        var channelTitle = this.props.teamDisplayName;
        var popoverContent;
        var isAdmin = false;
        var isDirect = false;

        if (channel) {
            popoverContent = (
                <MessageWrapper
                    message={channel.description}
                    options={{singleline: true, mentionHighlight: false}}
                />
            );
            isAdmin = Utils.isAdmin(this.state.member.roles);

            if (channel.type === 'O') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'P') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'D') {
                isDirect = true;
                if (this.state.users.length > 1) {
                    if (this.state.users[0].id === currentId) {
                        channelTitle = UserStore.getProfile(this.state.users[1].id).username;
                    } else {
                        channelTitle = UserStore.getProfile(this.state.users[0].id).username;
                    }
                }
            }

            if (channel.description.length === 0) {
                popoverContent = (
                    <div>
                        {'No channel description yet.'} <br/>
                        <a
                            href='#'
                            data-toggle='modal'
                            data-desc={channel.description}
                            data-title={channel.display_name}
                            data-channelid={channel.id}
                            data-target='#edit_channel'
                        >
                            {'Click here'}
                        </a> {'to add one.'}</div>
                );
            }
        }

        var collapseButtons = this.createCollapseButtons(currentId);

        var channelMenuDropdown = this.createDropdown(channel, channelTitle, isAdmin, isDirect, popoverContent);

        return (
            <nav
                className='navbar navbar-default navbar-fixed-top'
                role='navigation'
            >
                <div className='container-fluid theme'>
                    <div className='navbar-header'>
                        {collapseButtons}
                        {channelMenuDropdown}
                    </div>
                </div>
            </nav>
        );
    }
}

Navbar.defaultProps = {
    teamDisplayName: ''
};
Navbar.propTypes = {
    teamDisplayName: React.PropTypes.string
};
