// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {searchProfiles} from 'mattermost-redux/actions/users';

import {openModal} from 'actions/views/modals';
import {setPopoverSearchTerm} from 'actions/views/search';
import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import UserGroupPopover from './user_group_popover';

function mapStateToProps(state: GlobalState) {
    return {
        searchTerm: state.views.search.popoverSearch,
        isMobileView: getIsMobileView(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            setPopoverSearchTerm,
            openModal,
            searchProfiles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(UserGroupPopover);
