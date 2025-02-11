// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect} from './test_fixture';
export {assetPath, getBlobFromAsset, getFileFromAsset, getBlobFromCommonAsset, getFileFromCommonAsset} from './file';
export {baseGlobalSetup} from './global_setup';
export {duration, wait, getRandomId, defaultTeam, simpleEmailRe} from './util';
export {TestBrowser} from './browser_context';
export {testConfig} from './test_config';
export {
    createRandomTeam,
    createRandomChannel,
    getAdminClient,
    getDefaultAdminUser,
    makeClient,
    createRandomUser,
    createRandomPost,
} from './server';

export {pages, ChannelsPage, LandingLoginPage, LoginPage, SignupPage, ScheduledDraftPage, DraftPage} from './ui/pages';
export {
    components,
    GlobalHeader,
    ChannelsCenterView,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    ChannelsAppBar,
    ChannelsHeader,
    ChannelsPostCreate,
    ChannelsPostEdit,
    ChannelsPost,
    FindChannelsModal,
    DeletePostModal,
    PostDotMenu,
    PostMenu,
    ThreadFooter,
    MessagePriority,
    DeletePostConfirmationDialog,
} from './ui/components';
