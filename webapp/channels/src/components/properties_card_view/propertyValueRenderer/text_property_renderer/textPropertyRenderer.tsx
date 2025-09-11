// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

type Props = {
    value: PropertyValue<unknown>;
}

export default function TextPropertyRenderer({value}: Props) {
    return (
        <span
            className='TextProperty'
            data-testid='text-property'
        >
            {value.value}
        </span>
    );
}
