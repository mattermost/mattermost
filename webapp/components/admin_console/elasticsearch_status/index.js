// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getJobsByType} from 'mattermost-redux/actions/jobs';
import {JobTypes} from 'utils/constants.jsx';

import * as Selectors from 'mattermost-redux/selectors/entities/jobs';

import Status from './status.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        jobs: Selectors.makeGetJobsByType(JobTypes.ELASTICSEARCH_POST_INDEXING)(state)
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getJobsByType
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Status);
