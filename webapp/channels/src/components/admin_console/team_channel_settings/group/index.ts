// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

import type {GlobalState} from 'types/store';

import GroupList from './group_list';

export type OwnProps = {
    groups: Group[];
    onGroupRemoved: (gid: string) => void;
    setNewGroupRole: (gid: string) => void;
    isModeSync: boolean;
    totalGroups: number;
    isDisabled?: boolean;
    type: string;
    onPageChangedCallback?: () => void;
    team?: Team;
    channel?: Partial<Channel>;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        data: ownProps.groups,
        removeGroup: ownProps.onGroupRemoved,
        setNewGroupRole: ownProps.setNewGroupRole,
        total: ownProps.totalGroups,
    };
}

function mapDispatchToProps() {
    return {
        actions: {
            getData: () => Promise.resolve(),
        },
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(GroupList);

