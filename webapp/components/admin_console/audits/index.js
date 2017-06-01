// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getAudits} from 'mattermost-redux/actions/admin';

import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import Audits from './audits.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        audits: Object.values(Selectors.getAudits(state))
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getAudits
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Audits);
