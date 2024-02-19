// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getTermsOfService, createTermsOfService} from 'mattermost-redux/actions/users';

import CustomTermsOfServiceSettings from './custom_terms_of_service_settings';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTermsOfService,
            createTermsOfService,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(CustomTermsOfServiceSettings);
