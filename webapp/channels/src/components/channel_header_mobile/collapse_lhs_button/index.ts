// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GenericAction} from 'mattermost-redux/types/actions';

import {toggle as toggleLhs} from 'actions/views/lhs';

import CollapseLhsButton from './collapse_lhs_button';

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators({
        toggleLhs,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(CollapseLhsButton);

