// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {HealthFinding} from '@mattermost/types/health';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import {getDisplayNameByUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import RelativeTime from './relative_time';

const MutedBy = ({finding}: {finding: HealthFinding}) => {
    const userId = finding.muted_by ?? '';
    const name = useSelector((state: GlobalState) => getDisplayNameByUser(state, getUser(state, userId)));

    return (
        <FormattedMessage
            id='admin.health_dashboard.muted.by'
            defaultMessage='Muted by {name} {time}'
            values={{
                name: name || userId,
                time: <RelativeTime value={finding.muted_at ?? 0}/>,
            }}
        />
    );
};

export default MutedBy;
