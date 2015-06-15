// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Navbar = require('../components/navbar.jsx');
var Sidebar = require('../components/sidebar.jsx');
var ChannelHeader = require('../components/channel_header.jsx');
var PostList = require('../components/post_list.jsx');
var CreatePost = require('../components/create_post.jsx');
var SidebarRight = require('../components/sidebar_right.jsx');
var SidebarRightMenu = require('../components/sidebar_right_menu.jsx');
var GetLinkModal = require('../components/get_link_modal.jsx');
var MemberInviteModal = require('../components/invite_member_modal.jsx');
var EditChannelModal = require('../components/edit_channel_modal.jsx');
var DeleteChannelModal = require('../components/delete_channel_modal.jsx');
var RenameChannelModal = require('../components/rename_channel_modal.jsx');
var RenameTeamModal = require('../components/rename_team_modal.jsx');
var EditPostModal = require('../components/edit_post_modal.jsx');
var DeletePostModal = require('../components/delete_post_modal.jsx');
var MoreChannelsModal = require('../components/more_channels.jsx');
var NewChannelModal = require('../components/new_channel.jsx');
var PostDeletedModal = require('../components/post_deleted_modal.jsx');
var ChannelNotificationsModal = require('../components/channel_notifications.jsx');
var UserSettingsModal = require('../components/settings_modal.jsx');
var ChannelMembersModal = require('../components/channel_members.jsx');
var ChannelInviteModal = require('../components/channel_invite_modal.jsx');
var TeamMembersModal = require('../components/team_members.jsx');
var DirectChannelModal = require('../components/more_direct_channels.jsx');
var ErrorBar = require('../components/error_bar.jsx')
var ChannelLoader = require('../components/channel_loader.jsx');
var MentionList = require('../components/mention_list.jsx');
var ChannelInfoModal = require('../components/channel_info_modal.jsx');


var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

global.window.setup_channel_page = function(team_name, team_type, channel_name, channel_id) {

    AppDispatcher.handleViewAction({
      type: ActionTypes.CLICK_CHANNEL,
      name: channel_name,
      id: channel_id
    });

    React.render(
        <ErrorBar/>,
        document.getElementById('error_bar')
    );

    React.render(
        <ChannelLoader/>,
        document.getElementById('channel_loader')
    );

    React.render(
        <Navbar teamName={team_name} />,
        document.getElementById('navbar')
    );

    React.render(
        <Sidebar teamName={team_name} teamType={team_type} />,
        document.getElementById('sidebar-left')
    );

    React.render(
        <RenameTeamModal teamName={team_name} />,
        document.getElementById('rename_team_modal')
    );

    React.render(
        <GetLinkModal />,
        document.getElementById('get_link_modal')
    );

    React.render(
        <UserSettingsModal />,
        document.getElementById('user_settings_modal')
    );

    React.render(
        <TeamMembersModal teamName={team_name} />,
        document.getElementById('team_members_modal')
    );

    React.render(
        <MemberInviteModal />,
        document.getElementById('invite_member_modal')
    );

    React.render(
        <ChannelHeader />,
        document.getElementById('channel-header')
    );

    React.render(
        <EditChannelModal />,
        document.getElementById('edit_channel_modal')
    );

    React.render(
        <DeleteChannelModal />,
        document.getElementById('delete_channel_modal')
    );

    React.render(
        <RenameChannelModal />,
        document.getElementById('rename_channel_modal')
    );

    React.render(
        <ChannelNotificationsModal />,
        document.getElementById('channel_notifications_modal')
    );

    React.render(
        <ChannelMembersModal />,
        document.getElementById('channel_members_modal')
    );

    React.render(
        <ChannelInviteModal />,
        document.getElementById('channel_invite_modal')
    );

    React.render(
        <ChannelInfoModal />,
        document.getElementById('channel_info_modal')
    );

    React.render(
        <MoreChannelsModal />,
        document.getElementById('more_channels_modal')
    );

    React.render(
        <DirectChannelModal />,
        document.getElementById('direct_channel_modal')
    );

    React.render(
        <NewChannelModal />,
        document.getElementById('new_channel_modal')
    );

    React.render(
        <PostList />,
        document.getElementById('post-list')
    );

    React.render(
        <EditPostModal />,
        document.getElementById('edit_post_modal')
    );

    React.render(
        <DeletePostModal />,
        document.getElementById('delete_post_modal')
    );

    React.render(
        <PostDeletedModal />,
        document.getElementById('post_deleted_modal')
    );

    React.render(
        <CreatePost />,
        document.getElementById('post-create')
    );

    React.render(
        <SidebarRight />,
        document.getElementById('sidebar-right')
    );

    React.render(
        <SidebarRightMenu teamName={team_name} teamType={team_type} />,
        document.getElementById('sidebar-menu')
    );

    React.render(
        <MentionList id="post_textbox" />,
        document.getElementById('post_mention_tab')
    );

    React.render(
        <MentionList id="reply_textbox" />,
        document.getElementById('reply_mention_tab')
    );

    React.render(
        <MentionList id="edit_textbox" />,
        document.getElementById('edit_mention_tab')
    );

};
