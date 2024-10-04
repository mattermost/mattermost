// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import admin from './admin';
import channels from './channels';
import general from './general';
import posts from './posts';
import roles from './roles';
import search from './search';
import teams from './teams';
import users from './users';

export default combineReducers({
    channels,
    general,
    posts,
    teams,
    users,
    admin,
    search,
    roles,
});
