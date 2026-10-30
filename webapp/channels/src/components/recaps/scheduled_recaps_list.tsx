// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {ScheduledRecap} from '@mattermost/types/recaps';

import RecapsEmptyState from './recaps_empty_state';
import ScheduledRecapItem from './scheduled_recap_item';

type Props = {
    scheduledRecaps: ScheduledRecap[];
    onEdit: (id: string) => void;
    onCreateClick: () => void;
    createDisabled?: boolean;
};

const ScheduledRecapsList = ({scheduledRecaps, onEdit, onCreateClick, createDisabled}: Props) => {
    const {formatMessage} = useIntl();

    if (scheduledRecaps.length === 0) {
        return (
            <RecapsEmptyState
                className='scheduled-recaps-empty-state'
                title={formatMessage({id: 'recaps.scheduled.emptyState.title', defaultMessage: 'Set up your first recap'})}
                onCreateClick={onCreateClick}
                disabled={createDisabled}
            />
        );
    }

    return (
        <div className='scheduled-recaps-list'>
            {scheduledRecaps.map((scheduledRecap) => (
                <ScheduledRecapItem
                    key={scheduledRecap.id}
                    scheduledRecap={scheduledRecap}
                    onEdit={onEdit}
                />
            ))}
        </div>
    );
};

export default ScheduledRecapsList;
