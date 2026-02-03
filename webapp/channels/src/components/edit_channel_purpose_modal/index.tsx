// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import EditChannelPurposeModal from './edit_channel_purpose_modal';

function mapStateToProps(state: GlobalState) {
    return {
        ctrlSend: getBool(state, Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditChannelPurposeModal);
