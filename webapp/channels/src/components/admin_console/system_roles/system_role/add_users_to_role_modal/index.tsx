// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getProfiles, searchProfiles} from 'mattermost-redux/actions/users';
import {getProfiles as selectProfiles} from 'mattermost-redux/selectors/entities/users';

import AddUsersToRoleModal from './add_users_to_role_modal';

import type {Props} from './add_users_to_role_modal';
import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

function mapStateToProps(state: GlobalState, props: Props) {
    const filterOptions: {[key: string]: any} = {active: true, exclude_roles: [props.role.name]};
    const users: UserProfile[] = selectProfiles(state, filterOptions);

    return {
        users,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            getProfiles,
            searchProfiles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddUsersToRoleModal);
