// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import './selectPropertyRenderer.scss';

type Props = {
    value: PropertyValue<unknown>;
}

export function SelectPropertyRenderer({value}: Props) {
    return (
        <span className='SelectProperty'>
            {value.value}
        </span>
    );
}
