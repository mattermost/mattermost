// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, type MessageDescriptor} from 'react-intl';

type Props = {
    placeholder: MessageDescriptor;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder'>;

const LocalizedPlaceholderInput = React.forwardRef<HTMLInputElement, Props>(({placeholder, ...otherProps}, ref) => {
    const intl = useIntl();

    return (
        <input
            ref={ref}
            placeholder={intl.formatMessage(placeholder)}
            {...otherProps}
        />
    );
});

LocalizedPlaceholderInput.displayName = 'LocalizedPlaceholderInput';

export default LocalizedPlaceholderInput;
