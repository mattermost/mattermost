// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {GenericAction} from 'mattermost-redux/types/actions';

import {toggle as toggleLhs} from 'actions/views/lhs';

import CollapseLhsButton from './collapse_lhs_button';

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators({
        toggleLhs,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(CollapseLhsButton);

