// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getUserSettingsModalRevampEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store/index';

import SettingsButton from './settings_button';

function mapStateToProps(state: GlobalState) {
    return {
        isUserSettingsModalRevamp: getUserSettingsModalRevampEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsButton);
