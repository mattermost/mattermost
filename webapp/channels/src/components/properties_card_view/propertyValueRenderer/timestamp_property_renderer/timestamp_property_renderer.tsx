// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ComponentProps} from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import Timestamp from 'components/timestamp';

const getTimeFormat: ComponentProps<typeof Timestamp>['useTime'] = (_, {hour, minute, second}) => ({hour, minute, second});
const getDateFormat: ComponentProps<typeof Timestamp>['useDate'] = {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'};

type Props = {
    value: PropertyValue<unknown>;
}

export default function TimestampPropertyRenderer({value}: Props) {
    return (
        <div
            className='TimestampPropertyRenderer'
            data-testid='timestamp-property'
        >
            <Timestamp
                value={value.value as number}
                useSemanticOutput={false}
                useDate={getDateFormat}
                useTime={getTimeFormat}
            />
        </div>
    );
}
