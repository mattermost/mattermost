// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var ChannelView = require('../components/channel_view.jsx');
var ChannelLoader = require('../components/channel_loader.jsx');
var ErrorBar = require('../components/error_bar.jsx');
var ErrorStore = require('../stores/error_store.jsx');

var MentionList = require('../components/mention_list.jsx');
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
var ChannelInfoModal = require('../components/channel_info_modal.jsx');
var AccessHistoryModal = require('../components/access_history_modal.jsx');
var ActivityLogModal = require('../components/activity_log_modal.jsx');
var RemovedFromChannelModal = require('../components/removed_from_channel_modal.jsx');
var RegisterAppModal = require('../components/register_app_modal.jsx');
var ImportThemeModal = require('../components/user_settings/import_theme_modal.jsx');

var AsyncClient = require('../utils/async_client.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function setupChannelPage(props) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.CLICK_CHANNEL,
        name: props.ChannelName,
        id: props.ChannelId
    });

    AsyncClient.getAllPreferences();

    // ChannelLoader must be rendered first
    ReactDOM.render(
        <ChannelLoader/>,
        document.getElementById('channel_loader')
    );

    ReactDOM.render(
        <ErrorBar/>,
        document.getElementById('error_bar')
    );

    ReactDOM.render(
        <ChannelView

        />,
        document.getElementById('channel_view')
    );

    ReactDOM.render(
        <MentionList id='post_textbox' />,
        document.getElementById('post_mention_tab')
    );

    ReactDOM.render(
        <MentionList id='reply_textbox' />,
        document.getElementById('reply_mention_tab')
    );

    ReactDOM.render(
        <MentionList id='edit_textbox' />,
        document.getElementById('edit_mention_tab')
    );

    //
    // Modals
    //
    ReactDOM.render(
        <GetLinkModal />,
        document.getElementById('get_link_modal')
    );

    ReactDOM.render(
        <UserSettingsModal />,
        document.getElementById('user_settings_modal')
    );

    ReactDOM.render(
        <ImportThemeModal />,
        document.getElementById('import_theme_modal')
    );

    ReactDOM.render(
        <TeamSettingsModal />,
        document.getElementById('team_settings_modal')
    );

    ReactDOM.render(
        <TeamMembersModal teamDisplayName={props.TeamDisplayName} />,
        document.getElementById('team_members_modal')
    );

    ReactDOM.render(
        <MemberInviteModal teamType={props.TeamType} />,
        document.getElementById('invite_member_modal')
    );

    ReactDOM.render(
        <EditChannelModal />,
        document.getElementById('edit_channel_modal')
    );

    ReactDOM.render(
        <DeleteChannelModal />,
        document.getElementById('delete_channel_modal')
    );

    ReactDOM.render(
        <RenameChannelModal />,
        document.getElementById('rename_channel_modal')
    );

    ReactDOM.render(
        <ChannelNotificationsModal />,
        document.getElementById('channel_notifications_modal')
    );

    ReactDOM.render(
        <ChannelMembersModal />,
        document.getElementById('channel_members_modal')
    );

    ReactDOM.render(
        <ChannelInviteModal />,
        document.getElementById('channel_invite_modal')
    );

    ReactDOM.render(
        <ChannelInfoModal />,
        document.getElementById('channel_info_modal')
    );

    ReactDOM.render(
        <MoreChannelsModal />,
        document.getElementById('more_channels_modal')
    );

    ReactDOM.render(
        <EditPostModal />,
        document.getElementById('edit_post_modal')
    );

    ReactDOM.render(
        <DeletePostModal />,
        document.getElementById('delete_post_modal')
    );

    ReactDOM.render(
        <PostDeletedModal />,
        document.getElementById('post_deleted_modal')
    );

    ReactDOM.render(
        <AccessHistoryModal />,
        document.getElementById('access_history_modal')
    );

    ReactDOM.render(
        <ActivityLogModal />,
        document.getElementById('activity_log_modal')
    );

    ReactDOM.render(
        <RemovedFromChannelModal />,
        document.getElementById('removed_from_channel_modal')
    );

    ReactDOM.render(
        <RegisterAppModal />,
        document.getElementById('register_app_modal')
    );

    if (global.window.mm_config.SendEmailNotifications === 'false') {
        ErrorStore.storeLastError({message: 'Preview Mode: Email notifications have not been configured'});
        ErrorStore.emitChange();
    }
}

global.window.setup_channel_page = setupChannelPage;
