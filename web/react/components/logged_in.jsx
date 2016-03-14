// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from '../utils/async_client.jsx';
import * as GlobalActions from '../action_creators/global_actions.jsx';
import UserStore from '../stores/user_store.jsx';
import SocketStore from '../stores/socket_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';
import ErrorBar from '../components/error_bar.jsx';

import {browserHistory} from 'react-router';

import SidebarRight from '../components/sidebar_right.jsx';
import SidebarRightMenu from '../components/sidebar_right_menu.jsx';

// Modals
import GetPostLinkModal from '../components/get_post_link_modal.jsx';
import GetTeamInviteLinkModal from '../components/get_team_invite_link_modal.jsx';
import EditPostModal from '../components/edit_post_modal.jsx';
import DeletePostModal from '../components/delete_post_modal.jsx';
import MoreChannelsModal from '../components/more_channels.jsx';
import TeamSettingsModal from '../components/team_settings_modal.jsx';
import RemovedFromChannelModal from '../components/removed_from_channel_modal.jsx';
import RegisterAppModal from '../components/register_app_modal.jsx';
import ImportThemeModal from '../components/user_settings/import_theme_modal.jsx';
import InviteMemberModal from '../components/invite_member_modal.jsx';
import SelectTeamModal from '../components/admin_console/select_team_modal.jsx';

const CLIENT_STATUS_INTERVAL = 30000;
const BACKSPACE_CHAR = 8;

export default class LoggedIn extends React.Component {
    constructor(params) {
        super(params);

        this.onUserChanged = this.onUserChanged.bind(this);
    }
    onUserChanged() {
        // Grab the current user
        const user = UserStore.getCurrentUser();

        // Update segment indentify
        if (global.window.mm_config.SegmentDeveloperKey != null && global.window.mm_config.SegmentDeveloperKey !== '') {
            global.window.analytics.identify(user.id, {
                name: user.nickname,
                email: user.email,
                createdAt: user.create_at,
                username: user.username,
                team_id: user.team_id,
                id: user.id
            });
        }

        // Update CSS classes to match user theme
        if (user) {
            if ($.isPlainObject(user.theme_props) && !$.isEmptyObject(user.theme_props)) {
                Utils.applyTheme(user.theme_props);
            } else {
                Utils.applyTheme(Constants.THEMES.default);
            }
        }
    }
    onSocketChange(msg) {
        if (msg && msg.user_id && msg.user_id !== UserStore.getCurrentId()) {
            UserStore.setStatus(msg.user_id, 'online');
        }
    }
    componentWillMount() {
        // Emit view action
        GlobalActions.viewLoggedIn();

        // Listen for user
        UserStore.addChangeListener(this.onUserChanged);

        // Add listner for socker store
        SocketStore.addChangeListener(this.onSocketChange);

        // Get all statuses regularally. (Soon to be switched to websocket)
        this.intervalId = setInterval(() => AsyncClient.getStatuses(), CLIENT_STATUS_INTERVAL);

        // Force logout of all tabs if one tab is logged out
        $(window).bind('storage', (e) => {
            // when one tab on a browser logs out, it sets __logout__ in localStorage to trigger other tabs to log out
            if (e.originalEvent.key === '__logout__' && e.originalEvent.storageArea === localStorage && e.originalEvent.newValue) {
                // make sure it isn't this tab that is sending the logout signal (only necessary for IE11)
                if (window.BrowserStore.isSignallingLogout(e.originalEvent.newValue)) {
                    return;
                }

                console.log('detected logout from a different tab'); //eslint-disable-line no-console
                browserHistory.push('/' + this.props.params.team);
            }

            if (e.originalEvent.key === '__login__' && e.originalEvent.storageArea === localStorage && e.originalEvent.newValue) {
                // make sure it isn't this tab that is sending the logout signal (only necessary for IE11)
                if (window.BrowserStore.isSignallingLogin(e.originalEvent.newValue)) {
                    return;
                }

                console.log('detected login from a different tab'); //eslint-disable-line no-console
                location.reload();
            }
        });

        // Because current CSS requires the root tag to have specific stuff
        $('#root').attr('class', 'channel-view');

        // ???
        $('body').on('mouseenter mouseleave', '.post', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--before');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.search-item__container .post', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).closest('.search-item__container').find('.date-separator').addClass('hovered--after');
                $(this).closest('.search-item__container').next('div').find('.date-separator').addClass('hovered--before');
            } else {
                $(this).closest('.search-item__container').find('.date-separator').removeClass('hovered--after');
                $(this).closest('.search-item__container').next('div').find('.date-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.post.post--comment.same--root', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--comment');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--comment');
            }
        });

        // Device tracking setup
        var iOS = (/(iPad|iPhone|iPod)/g).test(navigator.userAgent);
        if (iOS) {
            $('body').addClass('ios');
        }

        // Set up tracking for whether the window is active
        window.isActive = true;
        $(window).on('focus', () => {
            AsyncClient.updateLastViewedAt();
            ChannelStore.resetCounts(ChannelStore.getCurrentId());
            ChannelStore.emitChange();
            window.isActive = true;
        });
        $(window).on('blur', () => {
            window.isActive = false;
        });

        // if preferences have already been stored in local storage do not wait until preference store change is fired and handled in channel.jsx
        const selectedFont = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'selected_font', Constants.DEFAULT_FONT);
        Utils.applyFont(selectedFont);

        // Pervent backspace from navigating back a page
        $(window).on('keydown.preventBackspace', (e) => {
            if (e.which === BACKSPACE_CHAR && !$(e.target).is('input, textarea')) {
                e.preventDefault();
            }
        });
    }
    componentWillUnmount() {
        $('#root').attr('class', '');
        clearInterval(this.intervalId);

        $(window).off('focus');
        $(window).off('blur');

        SocketStore.removeChangeListener(this.onSocketChange);
        UserStore.removeChangeListener(this.onUserChanged);

        $('body').off('click.userpopover');
        $('body').off('mouseenter mouseleave', '.post');
        $('body').off('mouseenter mouseleave', '.post.post--comment.same--root');

        $('.modal').off('show.bs.modal');

        $(window).off('keydown.preventBackspace');
    }
    render() {
        return (
            <div className='channel-view'>
                <ErrorBar/>
                <div className='container-fluid'>
                    <SidebarRight/>
                    <SidebarRightMenu/>
                    {this.props.sidebar}
                    {this.props.center}

                    <GetPostLinkModal/>
                    <GetTeamInviteLinkModal/>
                    <InviteMemberModal/>
                    <ImportThemeModal/>
                    <TeamSettingsModal/>
                    <MoreChannelsModal/>
                    <EditPostModal/>
                    <DeletePostModal/>
                    <RemovedFromChannelModal/>
                    <RegisterAppModal/>
                    <SelectTeamModal/>
                </div>
            </div>
        );
    }
}

LoggedIn.defaultProps = {
};

LoggedIn.propTypes = {
    children: React.PropTypes.object,
    sidebar: React.PropTypes.object,
    center: React.PropTypes.object,
    params: React.PropTypes.object
};
