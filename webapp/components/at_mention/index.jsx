// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';

import {getUsersByUsername} from 'mattermost-redux/selectors/entities/users';

import {searchForTerm} from 'actions/post_actions.jsx';

import AtMention from './at_mention.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        usersByUsername: getUsersByUsername(state)
    };
}

function mapDispatchToProps() {
    return {
        actions: {
            searchForTerm
        }
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AtMention);
