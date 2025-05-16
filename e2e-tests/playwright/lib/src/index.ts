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
    SearchPopover,
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
