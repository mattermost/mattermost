// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

import ChannelView from '../components/channel_view.jsx';
import ChannelLoader from '../components/channel_loader.jsx';
import ErrorBar from '../components/error_bar.jsx';
import ErrorStore from '../stores/error_store.jsx';

import GetTeamInviteLinkModal from '../components/get_team_invite_link_modal.jsx';
import RenameChannelModal from '../components/rename_channel_modal.jsx';
import EditPostModal from '../components/edit_post_modal.jsx';
import DeletePostModal from '../components/delete_post_modal.jsx';
import MoreChannelsModal from '../components/more_channels.jsx';
import PostDeletedModal from '../components/post_deleted_modal.jsx';
import TeamSettingsModal from '../components/team_settings_modal.jsx';
import RemovedFromChannelModal from '../components/removed_from_channel_modal.jsx';
import RegisterAppModal from '../components/register_app_modal.jsx';
import ImportThemeModal from '../components/user_settings/import_theme_modal.jsx';
import InviteMemberModal from '../components/invite_member_modal.jsx';

import PreferenceStore from '../stores/preference_store.jsx';

import * as Utils from '../utils/utils.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

import Constants from '../utils/constants.jsx';

function onPreferenceChange() {
    const selectedFont = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'selected_font', Constants.DEFAULT_FONT);
    Utils.applyFont(selectedFont);
    PreferenceStore.removeChangeListener(onPreferenceChange);
}

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupChannelPage(props, team, channel) {
    const locale = props.Locale;
    const messages = JSON.parse(props.Messages);

    if (props.PostId === '') {
        EventHelpers.emitChannelClickEvent(channel);
    } else {
        EventHelpers.emitPostFocusEvent(props.PostId);
    }

    PreferenceStore.addChangeListener(onPreferenceChange);
    AsyncClient.getAllPreferences();

    // ChannelLoader must be rendered first
    ReactDOM.render(
        <ChannelLoader/>,
        document.getElementById('channel_loader')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <ErrorBar/>
        </IntlProvider>,
        document.getElementById('error_bar')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <ChannelView/>
        </IntlProvider>,
        document.getElementById('channel_view')
    );

    //
    // Modals
    //
    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <GetTeamInviteLinkModal />
        </IntlProvider>,
        document.getElementById('get_team_invite_link_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <InviteMemberModal />
        </IntlProvider>,
        document.getElementById('invite_member_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <ImportThemeModal />
        </IntlProvider>,
        document.getElementById('import_theme_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <TeamSettingsModal teamType='team.type' />
        </IntlProvider>,
        document.getElementById('team_settings_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <RenameChannelModal />
        </IntlProvider>,
        document.getElementById('rename_channel_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <MoreChannelsModal />
        </IntlProvider>,
        document.getElementById('more_channels_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <EditPostModal />
        </IntlProvider>,
        document.getElementById('edit_post_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <DeletePostModal />
        </IntlProvider>,
        document.getElementById('delete_post_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <PostDeletedModal />
        </IntlProvider>,
        document.getElementById('post_deleted_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <RemovedFromChannelModal />
        </IntlProvider>,
        document.getElementById('removed_from_channel_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <RegisterAppModal />
        </IntlProvider>,
        document.getElementById('register_app_modal')
    );

    if (global.window.mm_config.SendEmailNotifications === 'false') {
        ErrorStore.storeLastError({message: messages.preview_mode});
        ErrorStore.emitChange();
    }
}

global.window.setup_channel_page = setupChannelPage;
