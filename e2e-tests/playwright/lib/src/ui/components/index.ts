// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {BaseComponent} from '../base_component';
export type {SnapNode} from '../base_component';
export {BasePage} from '../base_page';

// Shared / Global Components
import Footer from './footer';
import GlobalHeader from './global_header';
import MainHeader from './main_header';
import UserAccountMenu from './user_account_menu';
// Channels Components
import AutoTranslationPost from './channels/auto_translation_post';
import BrowseChannelsModal from './channels/browse_channels_modal';
import ChannelClassificationDropdown from './channels/channel_classification_dropdown';
import ChannelMembersRhs from './channels/channel_members_rhs';
import ChannelRuleEditor from './channels/channel_settings/channel_rule_editor';
import ChannelsAppBar from './channels/app_bar';
import {
    ChannelsCenterView,
    ChannelsHeader,
    ChannelsPostCreate,
    ChannelsPost,
    ChannelsPostEdit,
    PostMenu,
    ThreadFooter,
    BurnOnReadBadge,
    BurnOnReadTimerChip,
    BurnOnReadConcealedPlaceholder,
    BurnOnReadConfirmationModal,
    ChannelBookmarks,
} from './channels/center_view';
import CreateTeamForm from './channels/create_team_form';
import ChannelSettingsModal from './channels/channel_settings/channel_settings_modal';
import {ChannelsSidebarLeft} from './channels/sidebar_left';
import {ChannelsSidebarRight, ChannelInfoRhs, ChannelSearchResults} from './channels/sidebar_right';
import {ChannelNotificationsModal, UserGroupsModal} from './channels/common';
import DeletePostConfirmationDialog from './channels/delete_post_confirmation_dialog';
import DeletePostModal from './channels/delete_post_modal';
import DeleteScheduledPostModal from './channels/delete_scheduled_post_modal';
import DirectChannelsModal from './channels/direct_channels_modal';
import DraftPost from './channels/draft_post';
import EmojiGifPicker from './channels/emoji_gif_picker';
import FindChannelsModal from './channels/find_channels_modal';
import NewChannelModal from './channels/new_channel_modal';
import FlagPostConfirmationDialog from './channels/flag_post_confirmation_dialog';
import GenericConfirmModal from './channels/generic_confirm_modal';
import GlobalClassificationBannerChannels from './channels/global_classification_banner';
import IntroChannelView from './channels/intro_channel_view';
import InvitePeopleModal from './channels/invite_people_modal';
import MembersInvitedModal from './channels/members_invited_modal';
import MessagePriority from './channels/message_priority';
import PersonalAccessTokens from './channels/settings/personal_access_tokens';
import PersonalAccessTokensSection from './channels/settings/personal_access_tokens_section';
import PluginInteractiveDialog from './channels/plugin_interactive_dialog';
import PostDotMenu from './channels/post_dot_menu';
import PostReminderMenu from './channels/post_reminder_menu';
import ProfileModal from './channels/profile_modal';
export {CustomProfileAttributes} from './channels/profile_modal';
import RestorePostConfirmationDialog from './channels/restore_post_confirmation_dialog';
import ScheduledDraftModal from './channels/scheduled_draft_modal';
import ScheduledPost from './channels/scheduled_post';
import ScheduledPostIndicator from './channels/scheduled_post_indicator';
import ScheduleMessageMenu from './channels/schedule_message_menu';
import ScheduleMessageModal from './channels/schedule_message_modal';
import SearchBox from './channels/search_box';
import SearchResultsTeamSelector from './channels/search_results_team_selector';
import SendMessageNowModal from './channels/send_message_now_modal';
import SettingsModal from './channels/settings/settings_modal';
import ShowTranslationModal from './channels/show_translation_modal';
import TeamMenu from './channels/team_menu';
import TeamSettingsModal from './channels/team_settings/team_settings_modal';
import UserProfilePopover from './channels/user_profile_popover';
// System Console Components
import {
    AdminSectionPanel,
    DropdownSetting,
    NumberInputSetting,
    RadioSetting,
    TextInputSetting,
} from './system_console/base_components';
import AccessControlTestResultsModal from './system_console/sections/access_control/test_results_modal';
import FilePermissionsSection from './system_console/sections/access_control/file_permissions';
import JobDetailsModal from './system_console/sections/access_control/job_details_modal';
import MaskingSection from './system_console/sections/access_control/masking';
import PermissionPolicyForm from './system_console/sections/access_control/permission_policy_form';
import PolicyEditor from './system_console/sections/access_control/policy_editor';
import PolicyList from './system_console/sections/access_control/policy_list';
import RuleBuilder from './system_console/sections/access_control/rule_builder';
import SelectMembershipPolicyModal from './system_console/sections/access_control/select_policy_modal';
import AutoTranslationSystemConsoleSection from './system_console/sections/site_configuration/auto_translation';
import ClassificationMarkings from './system_console/sections/site_configuration/classification_markings';
import GlobalClassificationBanner from './system_console/sections/site_configuration/global_classification_banner';
import Notifications from './system_console/sections/site_configuration/notifications';
import SingleChannelGuests from './system_console/sections/site_configuration/single_channel_guests';
import TeamDirectorySection from './system_console/sections/site_configuration/team_directory';
import UsersAndTeams from './system_console/sections/site_configuration/users_and_teams';
import DelegatedGranularAdministration from './system_console/sections/user_management/delegated_granular_administration';
import ExportDataModal from './system_console/sections/user_management/export_data_modal';
import Localization from './system_console/sections/site_configuration/localization';
import PermissionsSystemScheme from './system_console/sections/user_management/permissions_system_scheme';
import RankedValuePicker from './system_console/sections/user_management/ranked_value_picker';
import SelfDeletingMessages from './system_console/sections/self_deleting_messages';
import AttributeBasedAccessControl from './system_console/sections/system_attributes/attribute_based_access_control';
import SystemProperties from './system_console/sections/system_attributes/system_properties';
import SystemRoles from './system_console/sections/user_management/system_roles';
import UserAttributesSection from './system_console/sections/user_management/user_attributes';
import UserDetail from './system_console/sections/user_management/user_detail';
import EditionAndLicense from './system_console/sections/about/edition_and_license';
import MobileSecurity from './system_console/sections/environment/mobile_security';
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
    AutoTranslationPost,
    ChannelBookmarks,
    ChannelClassificationDropdown,
    ChannelInfoRhs,
    ChannelMembersRhs,
    ChannelNotificationsModal,
    ChannelRuleEditor,
    ChannelsAppBar,
    ChannelsCenterView,
    ChannelSearchResults,
    CreateTeamForm,
    ChannelsHeader,
    ChannelsPost,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelSettingsModal,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    UserGroupsModal,
    DeletePostConfirmationDialog,
    DeletePostModal,
    DeleteScheduledPostModal,
    DirectChannelsModal,
    DraftPost,
    EmojiGifPicker,
    FindChannelsModal,
    FlagPostConfirmationDialog,
    IntroChannelView,
    NewChannelModal,
    BrowseChannelsModal,
    GenericConfirmModal,
    GlobalClassificationBannerChannels,
    InvitePeopleModal,
    MembersInvitedModal,
    MessagePriority,
    PersonalAccessTokens,
    PersonalAccessTokensSection,
    PluginInteractiveDialog,
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
    SearchResultsTeamSelector,
    SendMessageNowModal,
    SettingsModal,
    ShowTranslationModal,
    TeamMenu,
    TeamSettingsModal,
    ThreadFooter,
    UserProfilePopover,

    // Burn-on-Read
    BurnOnReadBadge,
    BurnOnReadTimerChip,
    BurnOnReadConcealedPlaceholder,
    BurnOnReadConfirmationModal,

    // System Console
    AdminSectionPanel,
    AccessControlTestResultsModal,
    AttributeBasedAccessControl,
    AutoTranslationSystemConsoleSection,
    ClassificationMarkings,
    DelegatedGranularAdministration,
    DropdownSetting,
    EditionAndLicense,
    ExportDataModal,
    FilePermissionsSection,
    GlobalClassificationBanner,
    JobDetailsModal,
    Localization,
    MaskingSection,
    MobileSecurity,
    Notifications,
    NumberInputSetting,
    PermissionPolicyForm,
    PermissionsSystemScheme,
    PolicyEditor,
    PolicyList,
    RadioSetting,
    RankedValuePicker,
    RuleBuilder,
    SelfDeletingMessages,
    SelectMembershipPolicyModal,
    SingleChannelGuests,
    SystemProperties,
    SystemRoles,
    TeamDirectorySection,
    UserAttributesSection,
    UsersAndTeams,
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
    AutoTranslationPost,
    ChannelBookmarks,
    ChannelClassificationDropdown,
    ChannelInfoRhs,
    ChannelMembersRhs,
    ChannelNotificationsModal,
    ChannelRuleEditor,
    ChannelsAppBar,
    ChannelsCenterView,
    ChannelSearchResults,
    CreateTeamForm,
    ChannelsHeader,
    ChannelsPost,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelSettingsModal,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    UserGroupsModal,
    DeletePostConfirmationDialog,
    DeletePostModal,
    DeleteScheduledPostModal,
    DirectChannelsModal,
    DraftPost,
    EmojiGifPicker,
    FindChannelsModal,
    FlagPostConfirmationDialog,
    IntroChannelView,
    NewChannelModal,
    BrowseChannelsModal,
    GenericConfirmModal,
    GlobalClassificationBannerChannels,
    InvitePeopleModal,
    MembersInvitedModal,
    MessagePriority,
    PersonalAccessTokens,
    PersonalAccessTokensSection,
    PluginInteractiveDialog,
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
    SearchResultsTeamSelector,
    SendMessageNowModal,
    SettingsModal,
    ShowTranslationModal,
    TeamMenu,
    TeamSettingsModal,
    ThreadFooter,
    UserProfilePopover,

    // Burn-on-Read
    BurnOnReadBadge,
    BurnOnReadTimerChip,
    BurnOnReadConcealedPlaceholder,
    BurnOnReadConfirmationModal,

    // System Console
    AdminSectionPanel,
    AccessControlTestResultsModal,
    AttributeBasedAccessControl,
    AutoTranslationSystemConsoleSection,
    ClassificationMarkings,
    DelegatedGranularAdministration,
    DropdownSetting,
    EditionAndLicense,
    ExportDataModal,
    FilePermissionsSection,
    GlobalClassificationBanner,
    JobDetailsModal,
    Localization,
    MaskingSection,
    MobileSecurity,
    Notifications,
    NumberInputSetting,
    PermissionPolicyForm,
    PermissionsSystemScheme,
    PolicyEditor,
    PolicyList,
    RadioSetting,
    RankedValuePicker,
    RuleBuilder,
    SelfDeletingMessages,
    SelectMembershipPolicyModal,
    SingleChannelGuests,
    SystemProperties,
    SystemRoles,
    TeamDirectorySection,
    UserAttributesSection,
    UsersAndTeams,
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
