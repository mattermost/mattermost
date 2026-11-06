// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './attribute_option_swatch.scss';

type Props = {
    color: string;
};

export function AttributeOptionSwatch({color}: Props) {
    return (
        <span
            className='AttributeOptionSwatch'
            data-testid='attribute-option-swatch'
            style={{backgroundColor: color}}
        />
    );
}

// Takes no size: Compass's leading slot already reserves a minimum width.
export function AttributeOptionVisualPlaceholder() {
    return <span data-testid='attribute-option-visual-placeholder'/>;
}
