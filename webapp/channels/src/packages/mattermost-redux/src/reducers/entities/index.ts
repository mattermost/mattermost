// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {MMReduxAction} from 'mattermost-redux/action_types';

import admin from './admin';
import apps from './apps';
import bots from './bots';
import channelBookmarks from './channel_bookmarks';
import channelCategories from './channel_categories';
import channels from './channels';
import cloud from './cloud';
import contentFlagging from './content_flagging';
import emojis from './emojis';
import files from './files';
import general from './general';
import groups from './groups';
import hostedCustomer from './hosted_customer';
import integrations from './integrations';
import jobs from './jobs';
import limits from './limits';
import posts from './posts';
import preferences from './preferences';
import roles from './roles';
import scheduledPosts from './scheduled_posts';
import schemes from './schemes';
import search, {fileRemovalFromSearchResults} from './search';
import sharedChannels from './shared_channels';
import teams from './teams';
import threads from './threads';
import typing from './typing';
import usage from './usage';
import users from './users';

const entitiesReducers = combineReducers({
    general,
    users,
    limits,
    teams,
    channels,
    posts,
    files,
    preferences,
    typing,
    integrations,
    emojis,
    admin,
    jobs,
    search,
    roles,
    schemes,
    groups,
    bots,
    threads,
    channelCategories,
    apps,
    cloud,
    usage,
    hostedCustomer,
    channelBookmarks,
    scheduledPosts,
    sharedChannels,
    contentFlagging,
});

export type EntitiesState = ReturnType<typeof entitiesReducers>;

export default function entities(state: EntitiesState, action: MMReduxAction) {
    const intermediateState = fileRemovalFromSearchResults(state, action);
    return entitiesReducers(intermediateState, action);
}
