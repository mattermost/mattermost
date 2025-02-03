// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import WithTooltip from 'components/with_tooltip';

type ProfileWithGroups = Partial<UserProfile & {
    groups: Array<Partial<Group>>;
}>;

interface UsersToRemoveGroupsProps {
    user: ProfileWithGroups;
}

export default function UsersToRemoveGroups(props: UsersToRemoveGroupsProps): JSX.Element {
    const {user} = props;
    const groups = user.groups || [];
    let column: JSX.Element | string;

    const message = (
        <FormattedMessage
            id={'team_channel_settings.group.group_user_row.numberOfGroups'}
            defaultMessage={'{amount, number} {amount, plural, one {Group} other {Groups}}'}
            values={{amount: groups.length}}
        />
    );

    if ((groups).length === 1) {
        column = String(groups[0].display_name);
    } else if (groups.length === 0) {
        column = message;
    } else {
        const tooltip = groups.map((g) => g.display_name).join(', ');

        column = (
            <WithTooltip
                title={tooltip}
            >
                <a href='#'>{message}</a>
            </WithTooltip>
        );
    }

    return (
        <div className='UsersToRemoveGroups'>
            {column}
        </div>
    );
}
