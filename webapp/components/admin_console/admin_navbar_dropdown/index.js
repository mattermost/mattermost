// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {deferNavigation} from 'actions/admin_actions.jsx';
import {getNavigationBlocked} from 'selectors/views/admin'; 

import AdminNavbarDropdown from './admin_navbar_dropdown.jsx';

function mapStateToProps(state, ownProps) { 
    return {
        ...ownProps,
        navigationBlocked: getNavigationBlocked(state)         
    };
};

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            deferNavigation
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AdminNavbarDropdown);