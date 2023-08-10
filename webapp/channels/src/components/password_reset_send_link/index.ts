// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {sendPasswordResetEmail} from 'mattermost-redux/actions/users';

import PasswordResetSendLink from './password_reset_send_link';

import type {ServerError} from '@mattermost/types/errors';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

type Actions = {
    sendPasswordResetEmail: (emal: string) => Promise<{data: any; error: ServerError}>;
}

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
        sendPasswordResetEmail,
    }, dispatch),
});

export default connect(null, mapDispatchToProps)(PasswordResetSendLink);
