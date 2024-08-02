// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {renameCategory} from 'mattermost-redux/actions/channel_categories';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {createCategory} from 'actions/views/channel_sidebar';

import type {GlobalState} from 'types/store';

import EditCategoryModal from './edit_category_modal';

function mapStateToProps(state: GlobalState) {
    return {
        currentTeamId: getCurrentTeamId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createCategory,
            renameCategory,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditCategoryModal);
