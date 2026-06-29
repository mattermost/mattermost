// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect, PlaywrightExtended} from './test_fixture';
export type {PagesMap} from './test_fixture';
export {default as en} from './i18n';
export {testConfig} from './test_config';
export {baseGlobalSetup} from './global_setup';
export {TestBrowser} from './browser_context';
export {getBlobFromAsset, getFileFromAsset} from './file';
export {decomposeKorean, koreanTestPhrase, typeHangulCharacterWithIme, typeHangulWithIme} from './ime';
export {duration, getRandomId, wait, newTestPassword, stripHtml} from './util';
export {LicenseSkus, appsPluginId, callsPluginId, playbooksPluginId} from './constant';

export {getAdminClient, mergeWithOnPremServerConfig, getOnPremServerConfig} from './server';

export {
    ChannelsPage,
    ContentReviewPage,
    DraftsPage,
    LandingLoginPage,
    LoginPage,
    RecapsPage,
    ResetPasswordPage,
    SearchResultsPopout,
    SignupPage,
    ScheduledPostsPage,
    SystemConsolePage,
    ThreadsPage,
} from './ui/pages';

export {
    components,
    GlobalHeader,
    SearchBox,
    AccessControlTestResultsModal,
    AutoTranslationPost,
    AutoTranslationSystemConsoleSection,
    ChannelBookmarks,
    ChannelClassificationDropdown,
    ChannelInfoRhs,
    ChannelMembersRhs,
    ChannelNotificationsModal,
    ChannelRuleEditor,
    ChannelsCenterView,
    ChannelSearchResults,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    UserGroupsModal,
    ChannelsAppBar,
    ChannelsHeader,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelsPost,
    ChannelSettingsModal,
    DraftPost,
    ExportDataModal,
    FilePermissionsSection,
    FindChannelsModal,
    DeletePostModal,
    DeleteScheduledPostModal,
    GlobalClassificationBanner,
    IntroChannelView,
    JobDetailsModal,
    MaskingSection,
    PersonalAccessTokens,
    PersonalAccessTokensSection,
    PermissionPolicyForm,
    PluginInteractiveDialog,
    RankedValuePicker,
    SearchResultsTeamSelector,
    SelectMembershipPolicyModal,
    SettingsModal,
    SingleChannelGuests,
    TeamDirectorySection,
    UserAttributesSection,
    PostDotMenu,
    PostMenu,
    ThreadFooter,
    Footer,
    MainHeader,
    PostReminderMenu,
    EmojiGifPicker,
    GenericConfirmModal,
    GlobalClassificationBannerChannels,
    ScheduleMessageMenu,
    ScheduleMessageModal,
    ScheduledPostIndicator,
    ScheduledDraftModal,
    ScheduledPost,
    SendMessageNowModal,
    ShowTranslationModal,
    SystemConsoleFeatureDiscovery,
    MessagePriority,
    UserProfilePopover,
    UserAccountMenu,
    DeletePostConfirmationDialog,
    RestorePostConfirmationDialog,
    ProfileModal,
} from './ui/components';

export {CustomProfileAttributes} from './ui/components';

export {PolicyEditor, PolicyList, RuleBuilder} from './ui/components';

export {
    AttributeBasedAccessControl,
    Localization,
    PermissionsSystemScheme,
    SelfDeletingMessages,
    SystemProperties,
    SystemRoles,
} from './ui/components';

export {BaseComponent, BasePage} from './ui/components';
export type {SnapNode} from './ui/components';

export {TextInputSetting} from './ui/components/system_console/base_components';

export {TestArgs, ScreenshotOptions} from './types';

export {
    enableAutotranslationConfig,
    disableAutotranslationConfig,
    enableChannelAutotranslation,
    disableChannelAutotranslation,
    setUserChannelAutotranslation,
    setMockSourceLanguage,
    ensureAutotranslationPermissions,
} from './autotranslation_helpers';
export type {EnableAutotranslationOptions} from './autotranslation_helpers';
export {
    hasAutotranslationLicense,
    hasSharedChannelsLicense,
    hasCustomPermissionsSchemesLicense,
    licenseTier,
} from './license_helpers';

// ABAC (Attribute-Based Access Control) helpers
export {
    createUserWithAttributes,
    enableABAC,
    disableABAC,
    navigateToABACPage,
    navigateToPermissionPoliciesPage,
    navigateToAttributeBasedAccessPage,
    createBasicPolicy,
    createAdvancedPolicy,
    editPolicy,
    deletePolicy,
    runSyncJob,
    verifyUserInChannel,
    verifyUserNotInChannel,
    updateUserAttributes,
} from './server';
