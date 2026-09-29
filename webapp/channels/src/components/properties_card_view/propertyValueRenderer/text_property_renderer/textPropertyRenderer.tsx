// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import type {TextFieldMetadata} from 'components/properties_card_view/properties_card_view';

type Props = {
    value: PropertyValue<unknown>;
    metadata?: TextFieldMetadata;
};

export default function TextPropertyRenderer({value, metadata}: Props) {
    const isSet = value.value !== null && value.value !== undefined && value.value !== '';

    return (
        <span
            className='TextProperty'
            data-testid='text-property'
        >
            {isSet && String(value.value)}

            {
                !isSet && metadata?.placeholder && (
                    <span className='TextProperty__placeholder'>
                        {metadata.placeholder}
                    </span>
                )
            }
        </span>
    );
}
