// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Group} from '@mattermost/types/groups';

import AbstractList from 'components/admin_console/team_channel_settings/abstract_list';

import GroupRow from './group_row';

import type {PropsFromRedux, OwnProps} from './index';

const Header = () => (
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

type Props = OwnProps & PropsFromRedux;

const GroupList = (props: Props) => {
    const {
        removeGroup,
        setNewGroupRole,
        type,
        isDisabled,
    } = props;

    const renderRow = (item: Partial<Group>) => {
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
    };

    return (
        <AbstractList
            header={<Header/>}
            renderRow={renderRow}
            {...props}
        />
    );
};

export default memo(GroupList);
