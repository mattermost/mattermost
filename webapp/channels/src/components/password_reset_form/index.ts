// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ServerError} from '@mattermost/types/errors';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {resetUserPassword} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import PasswordResetForm from './password_reset_form';

type Actions = {
    resetUserPassword: (token: string, newPassword: string) => Promise<{data: any; error: ServerError}>;
}

function mapStateToProps(state: GlobalState) {
    return {siteName: getConfig(state).SiteName};
}

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
        resetUserPassword,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(PasswordResetForm);
