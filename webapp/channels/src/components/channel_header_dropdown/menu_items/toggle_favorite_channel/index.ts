// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';

import ToggleFavoriteChannel from './toggle_favorite_channel';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators({
        favoriteChannel,
        unfavoriteChannel,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(ToggleFavoriteChannel);
