// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {updateChannelNotifyProps} from 'mattermost-redux/actions/channels';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import MenuItemToggleMuteChannel from './toggle_mute_channel';
import type {Actions} from './toggle_mute_channel';

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
        updateChannelNotifyProps,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(MenuItemToggleMuteChannel);
