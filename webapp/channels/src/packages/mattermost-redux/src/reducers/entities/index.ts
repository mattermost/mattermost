// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import channels from './channels';
import general from './general';
import users from './users';
import teams from './teams';
import posts from './posts';
import files from './files';
import preferences from './preferences';
import typing from './typing';
import integrations from './integrations';
import emojis from './emojis';
import admin from './admin';
import jobs from './jobs';
import search from './search';
import roles from './roles';
import schemes from './schemes';
import groups from './groups';
import bots from './bots';
import channelCategories from './channel_categories';
import apps from './apps';
import cloud from './cloud';
import hostedCustomer from './hosted_customer';
import usage from './usage';
import threads from './threads';

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
