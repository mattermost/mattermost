// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import admin from './admin';
import apps from './apps';
import bots from './bots';
import channelCategories from './channel_categories';
import channels from './channels';
import cloud from './cloud';
import emojis from './emojis';
import files from './files';
import general from './general';
import gifs from './gifs';
import groups from './groups';
import hostedCustomer from './hosted_customer';
import integrations from './integrations';
import jobs from './jobs';
import posts from './posts';
import preferences from './preferences';
import roles from './roles';
import schemes from './schemes';
import search from './search';
import teams from './teams';
import threads from './threads';
import typing from './typing';
import usage from './usage';
import users from './users';

export default combineReducers({
    general,
    users,
    teams,
    channels,
    posts,
    files,
    preferences,
    typing,
    integrations,
    emojis,
    gifs,
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
});
