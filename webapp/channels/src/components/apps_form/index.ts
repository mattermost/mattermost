// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {doAppSubmit, doAppFetchForm, doAppLookup, postEphemeralCallResponseForContext} from 'actions/apps';

import AppsFormContainer from './apps_form_container';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            doAppSubmit,
            doAppFetchForm,
            doAppLookup,
            postEphemeralCallResponseForContext,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(AppsFormContainer);
