// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {switchLdapToEmail, switchLdapToOAuth} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {getPasswordConfig} from 'utils/utils';

import {GlobalState} from '@mattermost/types/store';

import ClaimController, {Props} from './claim_controller';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const siteName = config.SiteName as string;
    const ldapLoginFieldName = config.LdapLoginFieldName as string;

    return {
        siteName,
        ldapLoginFieldName,
        passwordConfig: getPasswordConfig(config),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            switchLdapToEmail,
            switchLdapToOAuth,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ClaimController);
