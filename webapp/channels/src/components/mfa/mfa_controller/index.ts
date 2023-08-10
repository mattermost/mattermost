// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import MFAController from './mfa_controller';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const config = getConfig(state);

    const mfa = license.MFA === 'true';
    const enableMultifactorAuthentication = config.EnableMultifactorAuthentication === 'true';
    const enforceMultifactorAuthentication = config.EnforceMultifactorAuthentication === 'true';

    return {
        mfa,
        enableMultifactorAuthentication,
        enforceMultifactorAuthentication,
    };
}

export default connect(mapStateToProps)(MFAController);
