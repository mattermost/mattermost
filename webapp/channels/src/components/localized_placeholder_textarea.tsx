// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, type MessageDescriptor} from 'react-intl';

type Props = {
    placeholder: MessageDescriptor;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder'>;

const LocalizedPlaceholderTextarea = React.forwardRef<HTMLTextAreaElement, Props>(({placeholder, ...otherProps}, ref) => {
    const intl = useIntl();

    return (
        <textarea
            ref={ref}
            placeholder={intl.formatMessage(placeholder)}
            {...otherProps}
        />
    );
});

LocalizedPlaceholderTextarea.displayName = 'LocalizedPlaceholderTextarea';

export default LocalizedPlaceholderTextarea;
