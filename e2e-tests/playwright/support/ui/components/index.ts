// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsHeader} from './channels/header';
import {ChannelsAppBar} from './channels/app_bar';
import {ChannelsPostCreate} from './channels/post_create';
import {ChannelsPost} from './channels/post';
import {ChannelsCenterView} from './channels/center_view';
import {ChannelsSidebarLeft} from './channels/sidebar_left';
import {ChannelsSidebarRight} from './channels/sidebar_right';
import {DeletePostModal} from './channels/delete_post_modal';
import {FindChannelsModal} from './channels/find_channels_modal';
import {SettingsModal} from './channels/settings/settings_modal';
import {Footer} from './footer';
import {GlobalHeader} from './global_header';
import {MainHeader} from './main_header';
import {PostDotMenu} from './channels/post_dot_menu';
import {PostReminderMenu} from './channels/post_reminder_menu';
import {PostMenu} from './channels/post_menu';
import {ThreadFooter} from './channels/thread_footer';
import {EmojiGifPicker} from './channels/emoji_gif_picker';
import {GenericConfirmModal} from './channels/generic_confirm_modal';

import {SystemConsoleSidebar} from './system_console/sidebar';
import {SystemConsoleNavbar} from './system_console/navbar';

import {SystemUsers} from './system_console/sections/system_users/system_users';
import {SystemUsersFilterPopover} from './system_console/sections/system_users/filter_popover';
import {SystemUsersFilterMenu} from './system_console/sections/system_users/filter_menu';
import {SystemUsersColumnToggleMenu} from './system_console/sections/system_users/column_toggle_menu';

const components = {
    GlobalHeader,
    ChannelsCenterView,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    ChannelsAppBar,
    ChannelsHeader,
    ChannelsPostCreate,
    ChannelsPost,
    FindChannelsModal,
    DeletePostModal,
    SettingsModal,
    PostDotMenu,
    PostMenu,
    ThreadFooter,
    Footer,
    MainHeader,
    PostReminderMenu,
    EmojiGifPicker,
    GenericConfirmModal,
    SystemConsoleSidebar,
    SystemConsoleNavbar,
    SystemUsers,
    SystemUsersFilterPopover,
    SystemUsersFilterMenu,
    SystemUsersColumnToggleMenu,
};

export {
    components,
    GlobalHeader,
    ChannelsCenterView,
    ChannelsSidebarLeft,
    ChannelsSidebarRight,
    ChannelsAppBar,
    ChannelsHeader,
    ChannelsPostCreate,
    ChannelsPost,
    FindChannelsModal,
    DeletePostModal,
    PostDotMenu,
    PostMenu,
    ThreadFooter,
};
