// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {switchLdapToEmail} from 'mattermost-redux/actions/users';
import {getConfig, getPasswordConfig} from 'mattermost-redux/selectors/entities/general';

import ClaimController from './claim_controller';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const siteName = config.SiteName as string;
    const ldapLoginFieldName = config.LdapLoginFieldName as string;

    return {
        siteName,
        ldapLoginFieldName,
        passwordConfig: getPasswordConfig(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            switchLdapToEmail,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ClaimController);
