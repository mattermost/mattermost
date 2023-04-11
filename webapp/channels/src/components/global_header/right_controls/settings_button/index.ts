// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {GenericAction} from 'mattermost-redux/types/actions';
import {openModal} from 'actions/views/modals';

import SettingsButton from './settings_button';
import {GlobalState} from 'types/store';
import {getNewUIEnabled} from 'mattermost-redux/selectors/entities/preferences';

function mapStateToProps(state: GlobalState) {
    return {
        isNewUI: getNewUIEnabled(state),
    };
}
function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsButton);
