// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import {t} from 'utils/i18n';
import {Group} from '@mattermost/types/groups';
import List from './group_list';
import {GlobalState} from 'types/store';
import { Team } from '@mattermost/types/teams';
import { Channel } from '@mattermost/types/channels';

export type OwnProps = {
    groups: Group[];
    onPageChangedCallback?: () => void;
    totalGroups: number;
    isModeSync: boolean;
    onGroupRemoved: (gid: string) => void;
    setNewGroupRole: (gid: string) => void;
    emptyListTextId?: string,
    emptyListTextDefaultMessage?: string
    type?: string;
    team?: Team;
    channel?: Partial<Channel>;
    isDisabled?: boolean;
    actions?: {
        getData: () => Promise<any>;
    };
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        data: ownProps.groups,
        onPageChangedCallback: ownProps.onPageChangedCallback,
        total: ownProps.totalGroups,
        emptyListTextId: ownProps.isModeSync ? t('admin.team_channel_settings.group_list.no-synced-groups') : t('admin.team_channel_settings.group_list.no-groups'),
        emptyListTextDefaultMessage: ownProps.isModeSync ? 'At least one group must be specified' : 'No groups specified yet',
        removeGroup: ownProps.onGroupRemoved,
        setNewGroupRole: ownProps.setNewGroupRole,
        type: ownProps.type,
        team: ownProps.team,
        channel: ownProps.channel,
        isDisaabled: ownProps.isDisabled,
        actions: {
            getData: () => Promise.resolve(ownProps.groups),
        },
    };
}

const mapDispatchToProps = {
    getData: () => Promise.resolve() as any,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(List);
