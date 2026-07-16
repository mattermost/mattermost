// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect, PlaywrightExtended} from './test_fixture';
export {testConfig} from './test_config';
export {baseGlobalSetup} from './global_setup';
export {TestBrowser} from './browser_context';
export {getBlobFromAsset, getFileFromAsset} from './file';
export {decomposeKorean, koreanTestPhrase, typeHangulCharacterWithIme, typeHangulWithIme} from './ime';
export {duration, getRandomId, wait, newTestPassword} from './util';
export {LicenseSkus, appsPluginId, callsPluginId, playbooksPluginId} from './constant';

export {
    getAdminClient,
    mergeWithOnPremServerConfig,
    getOnPremServerConfig,
    MockRemoteClusterServer,
    SHARED_CHANNEL_MSG_TOPICS,
    buildRemoteClusterMsgOkResponse,
    REMOTE_CLUSTER_HEADERS,
    REMOTE_CLUSTER_RESPONSE_STATUS,
    mattermostNewId,
    decryptRemoteClusterInviteFromBase64,
    postRemoteClusterConfirmInviteFromPeer,
    type MockOutboundPeer,
    type NextConfirmInviteDecision,
    type NextRemoteClusterMsgDecision,
    type RemoteClusterMsgResponseWire,
    type MockRemoteClusterInboundRecord,
    type MockRemoteClusterServerOptions,
    type RemoteClusterFrameWire,
    type DecryptedRemoteClusterInvite,
    type PostRemoteClusterConfirmInviteFromPeerParams,
    type PostRemoteClusterConfirmInviteFromPeerResult,
    isWebhookTestServerReachable,
    setupWebhookTestServer,
    PlaywrightClient4,
} from './server';

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
} from './ui/components';

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
