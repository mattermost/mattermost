// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchConfig} from 'mattermost-redux/actions/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import type {GlobalState} from 'types/store';

import EditPostTimeLimitModal from './edit_post_time_limit_modal';

function mapStateToProps(state: GlobalState) {
    return {
        config: getConfig(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({patchConfig}, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditPostTimeLimitModal);
