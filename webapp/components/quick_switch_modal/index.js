// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';

import QuickSwitchModal from './quick_switch_modal.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        showTeamSwitcher: false
    };
}

export default connect(mapStateToProps)(QuickSwitchModal);
