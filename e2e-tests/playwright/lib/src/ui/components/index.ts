// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Shared / Global Components
import Footer from './footer';
import GlobalHeader from './global_header';
import MainHeader from './main_header';
import UserAccountMenu from './user_account_menu';
// Channels Components
import ChannelsAppBar from './channels/app_bar';
import ChannelsCenterView from './channels/center_view';
import ChannelsHeader from './channels/header';
import ChannelsPost from './channels/post';
import ChannelsPostCreate from './channels/post_create';
import ChannelsPostEdit from './channels/post_edit';
import ChannelSettingsModal from './channels/channel_settings/channel_settings_modal';
import ChannelsSidebarLeft from './channels/sidebar_left';
import ChannelsSidebarRight from './channels/sidebar_right';
import DeletePostConfirmationDialog from './channels/delete_post_confirmation_dialog';
import DeletePostModal from './channels/delete_post_modal';
import DeleteScheduledPostModal from './channels/delete_scheduled_post_modal';
import DraftPost from './channels/draft_post';
import EmojiGifPicker from './channels/emoji_gif_picker';
import FindChannelsModal from './channels/find_channels_modal';
import FlagPostConfirmationDialog from './channels/flag_post_confirmation_dialog';
import GenericConfirmModal from './channels/generic_confirm_modal';
import InvitePeopleModal from './channels/invite_people_modal';
import MessagePriority from './channels/message_priority';
import PostDotMenu from './channels/post_dot_menu';
import PostMenu from './channels/post_menu';
import PostReminderMenu from './channels/post_reminder_menu';
import ProfileModal from './channels/profile_modal';
import RestorePostConfirmationDialog from './channels/restore_post_confirmation_dialog';
import ScheduledDraftModal from './channels/scheduled_draft_modal';
import ScheduledPost from './channels/scheduled_post';
import ScheduledPostIndicator from './channels/scheduled_post_indicator';
import ScheduleMessageMenu from './channels/schedule_message_menu';
import ScheduleMessageModal from './channels/schedule_message_modal';
import SearchBox from './channels/search_box';
import SendMessageNowModal from './channels/send_message_now_modal';
import SettingsModal from './channels/settings/settings_modal';
import TeamMenu from './channels/team_menu';
import TeamSettingsModal from './channels/team_settings/team_settings_modal';
import ThreadFooter from './channels/thread_footer';
import UserProfilePopover from './channels/user_profile_popover';
// System Console Components
import {AdminSectionPanel, DropdownSetting, RadioSetting, TextInputSetting} from './system_console/base_components';
import DelegatedGranularAdministration from './system_console/sections/user_management/delegated_granular_administration';
import UserDetail from './system_console/sections/user_management/user_detail';
import EditionAndLicense from './system_console/sections/about/edition_and_license';
import MobileSecurity from './system_console/sections/environment/mobile_security';
import Notifications from './system_console/sections/site_configuration/notifications';
import SystemConsoleFeatureDiscovery from './system_console/sections/system_users/feature_discovery';
import SystemConsoleHeader from './system_console/header';
import SystemConsoleNavbar from './system_console/navbar';
import SystemConsoleSidebar from './system_console/sidebar';
import SystemConsoleSidebarHeader from './system_console/sidebar_header';
import TeamStatistics from './system_console/sections/reporting/team_statistics';
import Users from './system_console/sections/user_management/users';

const components = {
    // Shared / Global
    Footer,
    GlobalHeader,
    MainHeader,
    UserAccountMenu,

    // Channels
    ChannelsAppBar,
    ChannelsCenterView,
    ChannelsHeader,
    ChannelsPost,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelSettingsModal,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    DeletePostConfirmationDialog,
    DeletePostModal,
    DeleteScheduledPostModal,
    DraftPost,
    EmojiGifPicker,
    FindChannelsModal,
    FlagPostConfirmationDialog,
    GenericConfirmModal,
    InvitePeopleModal,
    MessagePriority,
    PostDotMenu,
    PostMenu,
    PostReminderMenu,
    ProfileModal,
    RestorePostConfirmationDialog,
    ScheduledDraftModal,
    ScheduledPost,
    ScheduledPostIndicator,
    ScheduleMessageMenu,
    ScheduleMessageModal,
    SearchBox,
    SendMessageNowModal,
    SettingsModal,
    TeamMenu,
    TeamSettingsModal,
    ThreadFooter,
    UserProfilePopover,

    // System Console
    AdminSectionPanel,
    DelegatedGranularAdministration,
    DropdownSetting,
    EditionAndLicense,
    MobileSecurity,
    Notifications,
    RadioSetting,
    SystemConsoleFeatureDiscovery,
    SystemConsoleHeader,
    SystemConsoleNavbar,
    SystemConsoleSidebar,
    SystemConsoleSidebarHeader,
    TeamStatistics,
    TextInputSetting,
    UserDetail,
    Users,
};

export {
    components,

    // Shared / Global
    Footer,
    GlobalHeader,
    MainHeader,
    UserAccountMenu,

    // Channels Page
    ChannelsAppBar,
    ChannelsCenterView,
    ChannelsHeader,
    ChannelsPost,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelSettingsModal,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    DeletePostConfirmationDialog,
    DeletePostModal,
    DeleteScheduledPostModal,
    DraftPost,
    EmojiGifPicker,
    FindChannelsModal,
    FlagPostConfirmationDialog,
    GenericConfirmModal,
    InvitePeopleModal,
    MessagePriority,
    PostDotMenu,
    PostMenu,
    PostReminderMenu,
    ProfileModal,
    RestorePostConfirmationDialog,
    ScheduledDraftModal,
    ScheduledPost,
    ScheduledPostIndicator,
    ScheduleMessageMenu,
    ScheduleMessageModal,
    SearchBox,
    SendMessageNowModal,
    SettingsModal,
    TeamMenu,
    TeamSettingsModal,
    ThreadFooter,
    UserProfilePopover,

    // System Console
    AdminSectionPanel,
    DelegatedGranularAdministration,
    DropdownSetting,
    EditionAndLicense,
    MobileSecurity,
    Notifications,
    RadioSetting,
    SystemConsoleFeatureDiscovery,
    SystemConsoleHeader,
    SystemConsoleNavbar,
    SystemConsoleSidebar,
    SystemConsoleSidebarHeader,
    TeamStatistics,
    TextInputSetting,
    UserDetail,
    Users,
};
