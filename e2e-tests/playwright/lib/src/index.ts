// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect, PlaywrightExtended} from './test_fixture';
export type {ExtendedFixtures} from './test_fixture';
export {testConfig, TESTCONTAINERS_SERVICE_NAMES} from './test_config';
export type {TestContainersServiceName} from './test_config';
export {baseGlobalSetup} from './global_setup';
export {TestBrowser} from './browser_context';
export {getBlobFromAsset, getFileFromAsset} from './file';
export {koreanTestPhrase, typeKoreanWithIme} from './ime';
export {duration, getRandomId, newTestPassword, wait} from './util';

export {
    getAdminClient,
    getOnPremServerConfig,
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
export type {LdapUser, KeycloakUser, MmctlResult} from './server';

export {startStack, stopStack} from './containers';

export {
    ChannelsPage,
    LandingLoginPage,
    LoginPage,
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
    SystemConsoleSidebar,
    SystemConsoleNavbar,
    SystemUsers,
    SystemUsersFilterPopover,
    SystemUsersFilterMenu,
    SystemUsersColumnToggleMenu,
    SystemConsoleFeatureDiscovery,
    SystemConsoleMobileSecurity,
    MessagePriority,
    UserProfilePopover,
    UserAccountMenu,
    DeletePostConfirmationDialog,
    RestorePostConfirmationDialog,
    ProfileModal,
} from './ui/components';

export {TestArgs, ScreenshotOptions} from './types';
