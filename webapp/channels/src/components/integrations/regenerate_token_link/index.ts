// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';

import RegenerateTokenLink from './regenerate_token_link';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => ({
    ...ownProps,
    ...stateProps,
    openModal: dispatchProps.actions.openModal,
}))(RegenerateTokenLink);
