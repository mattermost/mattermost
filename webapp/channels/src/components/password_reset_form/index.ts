// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {resetUserPassword} from 'mattermost-redux/actions/users';
import {getSiteName} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import PasswordResetForm from './password_reset_form';

function mapStateToProps(state: GlobalState) {
    return {
        siteName: getSiteName(state),
    };
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        resetUserPassword,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(PasswordResetForm);
