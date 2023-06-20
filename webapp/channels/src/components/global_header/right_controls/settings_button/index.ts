// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {GenericAction} from 'mattermost-redux/types/actions';
import {openModal} from 'actions/views/modals';

import SettingsButton from './settings_button';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(SettingsButton);
