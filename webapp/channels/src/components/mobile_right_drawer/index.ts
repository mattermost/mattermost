// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {getIsRhsMenuOpen} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import MobileRightDrawer from './mobile_right_drawer';

function mapStateToProps(state: GlobalState) {
    return {
        currentUser: getCurrentUser(state),
        isOpen: getIsRhsMenuOpen(state),
    };
}

const connector = connect(mapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps)(MobileRightDrawer);
