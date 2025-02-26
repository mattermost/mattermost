// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import AdminTypes from './admin';
import AppsTypes from './apps';
import BotTypes from './bots';
import ChannelBookmarkTypes from './channel_bookmarks';
import ChannelCategoryTypes from './channel_categories';
import ChannelTypes from './channels';
import CloudTypes from './cloud';
import DraftTypes from './drafts';
import EmojiTypes from './emojis';
import ErrorTypes from './errors';
import FileTypes from './files';
import GeneralTypes from './general';
import GroupTypes from './groups';
import HostedCustomerTypes from './hosted_customer';
import IntegrationTypes from './integrations';
import JobTypes from './jobs';
import LimitsTypes from './limits';
import PlaybookType from './playbooks';
import PluginTypes from './plugins';
import PostTypes from './posts';
import PreferenceTypes from './preferences';
import RoleTypes from './roles';
import SchemeTypes from './schemes';
import ScheduledPostTypes from './scheudled_posts';
import SearchTypes from './search';
import TeamTypes from './teams';
import ThreadTypes from './threads';
import UserTypes from './users';

export {
    ErrorTypes,
    GeneralTypes,
    UserTypes,
    TeamTypes,
    ChannelTypes,
    PostTypes,
    FileTypes,
    PreferenceTypes,
    IntegrationTypes,
    EmojiTypes,
    AdminTypes,
    JobTypes,
    LimitsTypes,
    SearchTypes,
    RoleTypes,
    SchemeTypes,
    GroupTypes,
    BotTypes,
    PluginTypes,
    ChannelCategoryTypes,
    CloudTypes,
    AppsTypes,
    ThreadTypes,
    HostedCustomerTypes,
    DraftTypes,
    PlaybookType,
    ChannelBookmarkTypes,
    ScheduledPostTypes,
};

/**
 * An MMReduxAction is any non-Thunk Redux action accepted by mattermost-redux.
 */
export type MMReduxAction = AnyAction;
