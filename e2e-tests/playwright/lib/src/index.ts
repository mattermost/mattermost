// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect, PlaywrightExtended} from './test_fixture';
export {testConfig, TESTCONTAINERS_SERVICE_NAMES} from './test_config';
export type {TestContainersServiceName} from './test_config';
export {baseGlobalSetup} from './global_setup';
export {TestBrowser} from './browser_context';
export {getBlobFromAsset, getFileFromAsset} from './file';
export {setupFileServer} from './file_server';
export {decomposeKorean, koreanTestPhrase, typeHangulCharacterWithIme, typeHangulWithIme} from './ime';
export {type SizeObservation, type SizeWatcher, watchElementSize} from './layout_shift';
export {duration, getRandomId, wait, newTestPassword} from './util';
export {LicenseSkus, appsPluginId, callsPluginId, playbooksPluginId} from './constant';

export {
    getAdminClient,
    mergeWithOnPremServerConfig,
    getOnPremServerConfig,
    getRecentEmail,
    extractEmailLink,
    isWebhookTestServerReachable,
    setupWebhookTestServer,
    PlaywrightClient4,
    generateLdapUser,
    createLdapUser,
    updateLdapUser,
    deleteLdapUser,
    ldapServerConfig,
    ensureOpenldap,
    createKeycloakUser,
    deleteKeycloakUser,
    listMinioObjectKeys,
    ensureMinio,
    samlServerConfig,
    ensureKeycloak,
    elasticsearchServerConfig,
    opensearchServerConfig,
    ensureElasticsearch,
    ensureOpensearch,
    ensureAzurite,
    listAzuriteBlobNames,
    ensureLocalFile,
    ensurePostgresSearch,
    ensureFeatureFlag,
    runMmctl,
    ensureMmctl,
} from './server';
export type {InbucketEmail, LdapUser, KeycloakUser, MmctlResult} from './server';

export {startStack, stopStack} from './containers';

export {
    ChannelsPage,
    LandingLoginPage,
    LoginPage,
    RecapsPage,
    ResetPasswordPage,
    SignupPage,
    ScheduledPostsPage,
    SystemConsolePage,
    DraftsPage,
} from './ui/pages';

export {
    components,
    GlobalHeader,
    SearchBox,
    ChannelsCenterView,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    ChannelsAppBar,
    ChannelsHeader,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelsPost,
    ChannelSettingsModal,
    DraftPost,
    FindChannelsModal,
    DeletePostModal,
    DeleteScheduledPostModal,
    SettingsModal,
    PostDotMenu,
    PostMenu,
    ThreadFooter,
    Footer,
    MainHeader,
    PostReminderMenu,
    EmojiGifPicker,
    GenericConfirmModal,
    ScheduleMessageMenu,
    ScheduleMessageModal,
    ScheduledPostIndicator,
    ScheduledDraftModal,
    ScheduledPost,
    SendMessageNowModal,
    SystemConsoleFeatureDiscovery,
    MessagePriority,
    UserProfilePopover,
    UserAccountMenu,
    DeletePostConfirmationDialog,
    RestorePostConfirmationDialog,
    ProfileModal,
    WysiwygEditor,
} from './ui/components';

export {setWysiwygUserPreference, WYSIWYG_PREF_CATEGORY, WYSIWYG_PREF_NAME} from './wysiwyg_helpers';

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
