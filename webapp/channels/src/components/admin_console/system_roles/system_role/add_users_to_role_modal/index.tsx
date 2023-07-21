// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {getProfiles, searchProfiles} from 'mattermost-redux/actions/users';
import {getProfiles as selectProfiles} from 'mattermost-redux/selectors/entities/users';
import {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';

import AddUsersToRoleModal, {Props} from './add_users_to_role_modal';

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
