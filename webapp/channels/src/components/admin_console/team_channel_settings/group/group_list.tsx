// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AbstractList from 'components/admin_console/team_channel_settings/abstract_list';

import GroupRow from './group_row';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

const Header = () => {
    return (
        <div className='groups-list--header'>
            <div className='group-name group-name-adjusted'>
                <FormattedMessage
                    id='admin.team_channel_settings.group_list.nameHeader'
                    defaultMessage='Group Name'
                />
            </div>
            <div className='group-content'>
                <div className='group-description group-description-adjusted'>
                    <FormattedMessage
                        id='admin.team_channel_settings.group_list.membersHeader'
                        defaultMessage='Member Count'
                    />
                </div>
                <div className='group-description group-description-adjusted'>
                    <FormattedMessage
                        id='admin.team_channel_settings.group_list.rolesHeader'
                        defaultMessage='Roles'
                    />
                </div>
                <div className='group-actions'/>
            </div>
        </div>
    );
};

interface Props {
    data?: Group[];
    onPageChangedCallback?: () => void;
    total: number;
    emptyListTextId: string;
    emptyListTextDefaultMessage: string;
    actions: {
        getData: () => Promise<Group[]>;
    };
    removeGroup: (gid: string) => void;
    setNewGroupRole: (gid: string) => void;
    type: string;
    team?: Team;
    channel?: Partial<Channel>;
    isDisabled?: boolean;
}

export default class GroupList extends React.PureComponent<Props> {
    renderRow = (item: Partial<Group>) => {
        return (
            <GroupRow
                key={item.id}
                group={item}
                removeGroup={this.props.removeGroup}
                setNewGroupRole={this.props.setNewGroupRole}
                type={this.props.type}
                isDisabled={this.props.isDisabled}
            />
        );
    };

    render(): JSX.Element {
        return (
            <AbstractList
                header={<Header/>}
                renderRow={this.renderRow}
                {...this.props}
            />
        );
    }
}
