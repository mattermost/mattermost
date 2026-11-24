// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

type Props = {
    field: PropertyField;
};

/**
 * The value shown for a required attribute that still has none and that the viewer
 * can fill in. It sits inside the control that opens the editor, so it carries no
 * behaviour of its own.
 */
export default function MissingValuePill({field}: Props) {
    return (
        <span
            className='ChannelInfoAttributes__missingValue'
            data-testid={`channelInfoAttributeMissing-${field.name}`}
        >
            {field.type === 'text' ? (
                <FormattedMessage
                    id='channel_attributes.info.enter_a_value'
                    defaultMessage='Enter a value'
                />
            ) : (
                <FormattedMessage
                    id='channel_attributes.info.select_a_value'
                    defaultMessage='Select a value'
                />
            )}
        </span>
    );
}
