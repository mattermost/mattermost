// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';

import {getUsersByUsername} from 'mattermost-redux/selectors/entities/users';

import AtMention from './at_mention.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        usersByUsername: getUsersByUsername(state)
    };
}

export default connect(mapStateToProps)(AtMention);
