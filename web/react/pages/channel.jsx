// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChannelView from '../components/channel_view.jsx';
import ChannelLoader from '../components/channel_loader.jsx';
import ErrorBar from '../components/error_bar.jsx';
import ErrorStore from '../stores/error_store.jsx';
import * as Client from '../utils/client.jsx';

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

var IntlProvider = ReactIntl.IntlProvider;

class Root extends React.Component {
    constructor() {
        super();
        this.state = {
            translations: null,
            loaded: false
        };
    }

    static propTypes() {
        return {
            map: React.PropTypes.object.isRequired
        };
    }

    componentWillMount() {
        Client.getTranslations(
            this.props.map.Locale,
            (data) => {
                this.setState({
                    translations: data,
                    loaded: true
                });
            },
            () => {
                this.setState({
                    loaded: true
                });
            }
        );
    }

    render() {
        if (!this.state.loaded) {
            return <div></div>;
        }

        return (
            <IntlProvider
                locale={this.props.map.Locale}
                messages={this.state.translations}
            >
                <div className='channel-view'>
                    <ChannelLoader/>
                    <ErrorBar/>
                    <ChannelView/>

                    <GetTeamInviteLinkModal />
                    <InviteMemberModal />
                    <ImportThemeModal />
                    <TeamSettingsModal />
                    <RenameChannelModal />
                    <MoreChannelsModal />
                    <EditPostModal />
                    <DeletePostModal />
                    <PostDeletedModal />
                    <RemovedFromChannelModal />
                    <RegisterAppModal />
                </div>
            </IntlProvider>
        );
    }
}

function onPreferenceChange() {
    const selectedFont = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'selected_font', Constants.DEFAULT_FONT);
    Utils.applyFont(selectedFont);
    PreferenceStore.removeChangeListener(onPreferenceChange);
}

global.window.setup_channel_page = function setup(props, team, channel) {
    if (props.PostId === '') {
        EventHelpers.emitChannelClickEvent(channel);
    } else {
        EventHelpers.emitPostFocusEvent(props.PostId);
    }

    PreferenceStore.addChangeListener(onPreferenceChange);
    AsyncClient.getAllPreferences();

    ReactDOM.render(
        <Root map={props} />,
        document.getElementById('channel_view')
    );

    if (global.window.mm_config.SendEmailNotifications === 'false') {
        ErrorStore.storeLastError({message: 'Preview Mode: Email notifications have not been configured'});
        ErrorStore.emitChange();
    }
};