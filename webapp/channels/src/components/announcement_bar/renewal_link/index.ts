// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GenericAction} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import RenewalLink from './renewal_link';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators(
            {
                openModal,
            },
            dispatch,
        ),
    };
}

export default connect(null, mapDispatchToProps)(RenewalLink);
