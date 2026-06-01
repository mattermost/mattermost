// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import EventTimestamp from 'components/event_timestamp';

type Props = {
    value: PropertyValue<unknown>;
}

export default function TimestampPropertyRenderer({value}: Props) {
    return (
        <div
            className='TimestampPropertyRenderer'
            data-testid='timestamp-property'
        >
            <EventTimestamp
                value={value.value as number}
            />
        </div>
    );
}
