// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {makeGetProfilesForReactions} from 'mattermost-redux/selectors/entities/users';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import * as Actions from 'mattermost-redux/actions/posts';

import ReactionsModal from './reactions_modal.jsx';



function makeMapStateToProps() {
    const getProfilesForReactions = makeGetProfilesForReactions();

    return function mapStateToProps(state, ownProps) {
        let profiles = getProfilesForReactions(state, ownProps.reactions || []);
        profiles = [...new Set(profiles.map(profile => profile))]; // selector from redux is not returning unique profiles

        return {
            ...ownProps,
            profiles
        };
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getMissingProfilesByIds
        }, dispatch)
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ReactionsModal);
