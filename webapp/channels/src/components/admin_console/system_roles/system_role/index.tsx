// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {Role} from '@mattermost/types/roles';

import {editRole} from 'mattermost-redux/actions/roles';
import {updateUserRoles} from 'mattermost-redux/actions/users';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getRolesById} from 'mattermost-redux/selectors/entities/roles';
import type {GenericAction, ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import SystemRole from './system_role';

type Props = {
    match: {
        params: {
            role_id: string;
        };
    };
}

type Actions = {
    editRole(role: Role): Promise<ActionResult>;
    updateUserRoles(userId: string, roles: string): Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => void;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const role = getRolesById(state)[props.match.params.role_id];
    const license = getLicense(state);
    const isLicensedForCloud = license.Cloud === 'true';

    return {
        isLicensedForCloud,
        role,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            editRole,
            updateUserRoles,
            setNavigationBlocked,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemRole);
