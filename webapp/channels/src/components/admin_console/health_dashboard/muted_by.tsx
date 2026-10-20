// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {HealthFinding} from '@mattermost/types/health';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import Avatar from 'components/widgets/users/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import RelativeTime from './relative_time';

const MutedBy = ({finding}: {finding: HealthFinding}) => {
    const userId = finding.muted_by ?? '';
    const user = useSelector((state: GlobalState) => getUser(state, userId));
    const displayName = useSelector((state: GlobalState) => getDisplayNameByUser(state, user));

    let name: React.ReactNode = userId;
    if (user) {
        const label = displayName === user.username ? `@${user.username}` : displayName;
        name = (
            <span className='HealthFinding__mutedBy'>
                <Avatar
                    size='xxs'
                    url={imageURLForUser(user.id, user.last_picture_update)}
                    alt=''
                />
                {label}
            </span>
        );
    }

    return (
        <FormattedMessage
            id='admin.health_dashboard.muted.by'
            defaultMessage='Muted by {name} {time}'
            values={{
                name,
                time: <RelativeTime value={finding.muted_at ?? 0}/>,
            }}
        />
    );
};

export default MutedBy;
