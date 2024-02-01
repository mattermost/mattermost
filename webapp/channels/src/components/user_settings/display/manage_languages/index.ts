// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateMe} from 'mattermost-redux/actions/users';

import ManageLanguages from './manage_languages';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateMe,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(ManageLanguages);
