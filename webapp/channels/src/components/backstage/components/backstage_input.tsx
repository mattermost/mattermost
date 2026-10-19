// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Input from 'components/widgets/inputs/input/input';
import type {InputProps} from 'components/widgets/inputs/input/input';

/**
 * Compass TextInput / TextArea for backstage (Integrations) forms.
 * Keeps the classic left-column label — no floating legend.
 */
const BackstageInput = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>((props, ref) => {
    const {useLegend: _useLegend, 'aria-label': ariaLabel, name, id, ...rest} = props;

    return (
        <Input
            {...rest}
            ref={ref}
            id={id}
            name={name || id}
            useLegend={false}
            aria-label={ariaLabel}
        />
    );
});

BackstageInput.displayName = 'BackstageInput';

export default BackstageInput;
