// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Navbar = require('../components/navbar.jsx');
var Sidebar = require('../components/sidebar.jsx');
var ChannelHeader = require('../components/channel_header.jsx');
var PostListContainer = require('../components/post_list_container.jsx');
var CreatePost = require('../components/create_post.jsx');
var SidebarRight = require('../components/sidebar_right.jsx');
var SidebarRightMenu = require('../components/sidebar_right_menu.jsx');
var GetLinkModal = require('../components/get_link_modal.jsx');
var MemberInviteModal = require('../components/invite_member_modal.jsx');
var EditChannelModal = require('../components/edit_channel_modal.jsx');
var DeleteChannelModal = require('../components/delete_channel_modal.jsx');
var RenameChannelModal = require('../components/rename_channel_modal.jsx');
var EditPostModal = require('../components/edit_post_modal.jsx');
var DeletePostModal = require('../components/delete_post_modal.jsx');
var MoreChannelsModal = require('../components/more_channels.jsx');
var PostDeletedModal = require('../components/post_deleted_modal.jsx');
var ChannelNotificationsModal = require('../components/channel_notifications.jsx');
var UserSettingsModal = require('../components/user_settings/user_settings_modal.jsx');
var TeamSettingsModal = require('../components/team_settings_modal.jsx');
var ChannelMembersModal = require('../components/channel_members.jsx');
var ChannelInviteModal = require('../components/channel_invite_modal.jsx');
var TeamMembersModal = require('../components/team_members.jsx');
var DirectChannelModal = require('../components/more_direct_channels.jsx');
var ErrorBar = require('../components/error_bar.jsx');
var ErrorStore = require('../stores/error_store.jsx');
var ChannelLoader = require('../components/channel_loader.jsx');
var MentionList = require('../components/mention_list.jsx');
var ChannelInfoModal = require('../components/channel_info_modal.jsx');
var AccessHistoryModal = require('../components/access_history_modal.jsx');
var ActivityLogModal = require('../components/activity_log_modal.jsx');
var RemovedFromChannelModal = require('../components/removed_from_channel_modal.jsx');
var FileUploadOverlay = require('../components/file_upload_overlay.jsx');
var RegisterAppModal = require('../components/register_app_modal.jsx');
var ImportThemeModal = require('../components/user_settings/import_theme_modal.jsx');
var TeamStore = require('../stores/team_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function setupChannelPage(props) {
    TeamStore.setCurrentId(props.TeamId);

    AppDispatcher.handleViewAction({
        type: ActionTypes.CLICK_CHANNEL,
        name: props.ChannelName,
        id: props.ChannelId
    });

    AppDispatcher.handleViewAction({
        type: ActionTypes.CLICK_TEAM,
        id: props.TeamId
    });

    // ChannelLoader must be rendered first
    React.render(
        <ChannelLoader/>,
        document.getElementById('channel_loader')
    );

    React.render(
        <ErrorBar/>,
        document.getElementById('error_bar')
    );

    React.render(
        <Navbar teamDisplayName={props.TeamDisplayName} />,
        document.getElementById('navbar')
    );

    React.render(
        <Sidebar
            teamDisplayName={props.TeamDisplayName}
            teamName={props.TeamName}
            teamType={props.TeamType}
        />,
        document.getElementById('sidebar-left')
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
        <ImportThemeModal />,
        document.getElementById('import_theme_modal')
    );

    React.render(
        <TeamSettingsModal teamDisplayName={props.TeamDisplayName} />,
        document.getElementById('team_settings_modal')
    );

    React.render(
        <TeamMembersModal teamDisplayName={props.TeamDisplayName} />,
        document.getElementById('team_members_modal')
    );

    React.render(
        <MemberInviteModal teamType={props.TeamType} />,
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
        <PostListContainer />,
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
        <SidebarRightMenu
            teamDisplayName={props.TeamDisplayName}
            teamType={props.TeamType}
        />,
        document.getElementById('sidebar-menu')
    );

    React.render(
        <MentionList id='post_textbox' />,
        document.getElementById('post_mention_tab')
    );

    React.render(
        <MentionList id='reply_textbox' />,
        document.getElementById('reply_mention_tab')
    );

    React.render(
        <MentionList id='edit_textbox' />,
        document.getElementById('edit_mention_tab')
    );

    React.render(
        <AccessHistoryModal />,
        document.getElementById('access_history_modal')
    );

    React.render(
        <ActivityLogModal />,
        document.getElementById('activity_log_modal')
    );

    React.render(
        <RemovedFromChannelModal />,
        document.getElementById('removed_from_channel_modal')
    );

    React.render(
        <FileUploadOverlay
            overlayType='center'
        />,
        document.getElementById('file_upload_overlay')
    );

    React.render(
        <RegisterAppModal />,
        document.getElementById('register_app_modal')
    );

    if (global.window.config.SendEmailNotifications === 'false') {
        ErrorStore.storeLastError({message: 'Preview Mode: Email notifications have not been configured'});
        ErrorStore.emitChange();
    }
}

global.window.setup_channel_page = setupChannelPage;
