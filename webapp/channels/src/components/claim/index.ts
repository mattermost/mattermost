// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {switchLdapToEmail} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';

import {getPasswordConfig} from 'utils/utils';

import ClaimController from './claim_controller';
import type {Props} from './claim_controller';

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
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ClaimController);
