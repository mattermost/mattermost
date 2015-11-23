// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelView from '../components/channel_view.jsx';
import ChannelLoader from '../components/channel_loader.jsx';
import ErrorBar from '../components/error_bar.jsx';
import ErrorStore from '../stores/error_store.jsx';

import MentionList from '../components/mention_list.jsx';
import GetLinkModal from '../components/get_link_modal.jsx';
import EditChannelModal from '../components/edit_channel_modal.jsx';
import RenameChannelModal from '../components/rename_channel_modal.jsx';
import EditPostModal from '../components/edit_post_modal.jsx';
import DeletePostModal from '../components/delete_post_modal.jsx';
import MoreChannelsModal from '../components/more_channels.jsx';
import PostDeletedModal from '../components/post_deleted_modal.jsx';
import TeamSettingsModal from '../components/team_settings_modal.jsx';
import TeamMembersModal from '../components/team_members.jsx';
import RemovedFromChannelModal from '../components/removed_from_channel_modal.jsx';
import RegisterAppModal from '../components/register_app_modal.jsx';
import ImportThemeModal from '../components/user_settings/import_theme_modal.jsx';
import InviteMemberModal from '../components/invite_member_modal.jsx';

import * as AsyncClient from '../utils/async_client.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

function setupChannelPage(props, team, channel) {
    if (props.PostId === '') {
        EventHelpers.emitChannelClickEvent(channel);
    } else {
        EventHelpers.emitPostFocusEvent(props.PostId);
    }

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
        <ChannelView/>,
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
        <InviteMemberModal />,
        document.getElementById('invite_member_modal')
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
        <EditChannelModal />,
        document.getElementById('edit_channel_modal')
    );

    ReactDOM.render(
        <RenameChannelModal />,
        document.getElementById('rename_channel_modal')
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
