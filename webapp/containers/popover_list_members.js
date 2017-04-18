// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getProfilesInChannel} from 'mattermost-redux/actions/users';

import PopoverListMembers from 'components/popover_list_members.jsx';

function makeMapStateToProps() {
    return function mapStateToProps(state, ownProps) {
        return {
            ...ownProps
        };
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getProfilesInChannel
        }, dispatch)
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PopoverListMembers);
