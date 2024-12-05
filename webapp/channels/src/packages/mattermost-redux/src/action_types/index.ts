// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BatchAction} from 'redux-batched-actions';

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
import type {AnyActionFrom} from './types';
import type {UserAction} from './users';
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
 * An InitAction is an empty action to initialize the Redux state, similar to the internal one used by Redux itself.
 *
 * It should only be used for testing.
 */
export interface InitAction {
    type: undefined;
}

/**
 * An ActionWithUndefinedStructure is any Redux action supported by mattermost-redux for which we haven't defined the
 * required structure. All fields of it other than the the type itself will not be type checked.
 */
type ActionWithUndefinedStructure = AnyActionFrom<
    typeof ErrorTypes &
    typeof GeneralTypes &
    typeof TeamTypes &
    typeof ChannelTypes &
    typeof PostTypes &
    typeof FileTypes &
    typeof PreferenceTypes &
    typeof IntegrationTypes &
    typeof EmojiTypes &
    typeof AdminTypes &
    typeof JobTypes &
    typeof LimitsTypes &
    typeof SearchTypes &
    typeof RoleTypes &
    typeof SchemeTypes &
    typeof GroupTypes &
    typeof BotTypes &
    typeof PluginTypes &
    typeof ChannelCategoryTypes &
    typeof CloudTypes &
    typeof AppsTypes &
    typeof ThreadTypes &
    typeof HostedCustomerTypes &
    typeof DraftTypes &
    typeof PlaybookType &
    typeof ChannelBookmarkTypes &
    typeof ScheduledPostTypes
>;

/**
 * An MMReduxAction is any non-Thunk Redux action accepted by mattermost-redux.
 */
export type MMReduxAction = InitAction | BatchAction | UserAction | ActionWithUndefinedStructure;
