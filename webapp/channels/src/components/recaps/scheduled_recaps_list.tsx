// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ScheduledRecap} from '@mattermost/types/recaps';

import ScheduledRecapItem from './scheduled_recap_item';
import ScheduledRecapsEmptyState from './scheduled_recaps_empty_state';

type Props = {
    scheduledRecaps: ScheduledRecap[];
    onEdit: (id: string) => void;
    onCreateClick: () => void;
    createDisabled?: boolean;
};

const ScheduledRecapsList = ({scheduledRecaps, onEdit, onCreateClick, createDisabled}: Props) => {
    if (scheduledRecaps.length === 0) {
        return (
            <ScheduledRecapsEmptyState
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
