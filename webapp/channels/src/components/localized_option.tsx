// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, type MessageDescriptor} from 'react-intl';

type Props = React.OptionHTMLAttributes<HTMLOptionElement> & {
    text: MessageDescriptor;
};

export default function LocalizedOption({text, ...otherProps}: Props) {
    const intl = useIntl();

    return (
        <option {...otherProps}>
            {intl.formatMessage(text)}
        </option>
    );
}
