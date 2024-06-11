// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {Group} from '@mattermost/types/groups';

import AbstractList from 'components/admin_console/team_channel_settings/abstract_list';

import GroupRow from './group_row';

import type {PropsFromRedux, OwnProps} from './index';

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

type Props = OwnProps & PropsFromRedux;

const GroupList = ({
    removeGroup,
    setNewGroupRole,
    type,
    isDisabled,
    isModeSync,
    ...restProps
}: Props) => {
    const renderRow = useCallback((item: Partial<Group>) => {
        return (
            <GroupRow
                key={item.id}
                group={item}
                removeGroup={removeGroup}
                setNewGroupRole={setNewGroupRole}
                type={type}
                isDisabled={isDisabled}
            />
        );
    }, [isDisabled, removeGroup, setNewGroupRole, type]);

    return (
        <AbstractList
            header={<Header/>}
            renderRow={renderRow}
            emptyListText={isModeSync ? messages.emptyListModeSync : messages.emptyList}
            {...restProps}
        />
    );
};

const messages = defineMessages({
    emptyListModeSync: {
        id: 'admin.team_channel_settings.group_list.no-synced-groups',
        defaultMessage: 'At least one group must be specified',
    },
    emptyList: {
        id: 'admin.team_channel_settings.group_list.no-groups',
        defaultMessage: 'No groups specified yet',
    },
});

export default memo(GroupList);
