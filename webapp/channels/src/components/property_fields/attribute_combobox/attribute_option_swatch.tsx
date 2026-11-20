// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './attribute_option_swatch.scss';

type Props = {
    color: string;
    testId?: string;
};

export function AttributeOptionSwatch({color, testId}: Props) {
    return (
        <span
            className='AttributeOptionSwatch'
            data-testid={testId}
            style={{backgroundColor: color}}
        />
    );
}

// Takes no size: Compass's leading slot already reserves a minimum width.
export function AttributeOptionVisualPlaceholder({testId}: {testId?: string}) {
    return <span data-testid={testId}/>;
}
