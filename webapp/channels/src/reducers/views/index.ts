// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import addChannelCtaDropdown from './add_channel_cta_dropdown';
import admin from './admin';
import announcementBar from './announcement_bar';
import browser from './browser';
import channel from './channel';
import channelSelectorModal from './channel_selector_modal';
import channelSidebar from './channel_sidebar';
import drafts from './drafts';
import emoji from './emoji';
import i18n from './i18n';
import lhs from './lhs';
import marketplace from './marketplace';
import modals from './modals';
import notice from './notice';
import onboardingTasks from './onboarding_tasks';
import posts from './posts';
import productMenu from './product_menu';
import rhs from './rhs';
import rhsSuppressed from './rhs_suppressed';
import search from './search';
import settings from './settings';
import system from './system';
import textbox from './textbox';
import threads from './threads';

export default combineReducers({
    admin,
    announcementBar,
    browser,
    channel,
    rhs,
    rhsSuppressed,
    posts,
    modals,
    emoji,
    i18n,
    lhs,
    search,
    notice,
    system,
    channelSelectorModal,
    settings,
    marketplace,
    textbox,
    channelSidebar,
    addChannelCtaDropdown,
    onboardingTasks,
    threads,
    productMenu,
    drafts,
});
