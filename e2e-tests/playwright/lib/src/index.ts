// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect, PlaywrightExtended} from './test_fixture';
export {testConfig} from './test_config';
export {baseGlobalSetup} from './global_setup';
export {TestBrowser} from './browser_context';
export {getBlobFromAsset, getFileFromAsset} from './file';
export {duration, wait} from './util';

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

// Autonomous testing exports
export {SpecBridge, createAnthropicBridge, createOllamaBridge} from './spec-bridge';
export {SpecificationParser} from './autonomous/spec_parser';
export {LLMProviderFactory} from 'e2e-ai-agents';

// Export types separately to satisfy isolatedModules
export type {SpecBridgeConfig, ConversionResult} from './spec-bridge';
export type {LLMProvider, ProviderConfig, HybridConfig} from 'e2e-ai-agents';
export type {FeatureSpecification, BusinessScenario, SpecScreenshot} from './autonomous/types';
