// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';

import type {Dispatch} from 'redux';

import {t} from 'utils/i18n';

import type {GlobalState} from 'types/store';

import GroupList from './group_list';
import type {Props} from './group_list';

import type {GenericAction} from 'mattermost-redux/types/actions';

import type {Group} from '@mattermost/types/groups';

function mapStateToProps(state: GlobalState, ownProps: Props) {
    return {
        data: ownProps.data,
        removeGroup: ownProps.removeGroup,
        setNewGroupRole : ownProps.setNewGroupRole,
        emptyListTextId: ownProps.isDisabled ? t('admin.team_channel_settings.group_list.no-synced-groups') : t('admin.team_channel_settings.group_list.no-groups'),
        emptyListTextDefaultMessage: ownProps.isDisabled ? 'At least one group must be specified' : 'No groups specified yet',
        total: ownProps.total,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            getData: () => Promise.resolve([] as Group[]),
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GroupList);

