// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import sharedChannels from './shared_channels';

const entities = combineReducers({
    sharedChannels,
});

export default entities;