// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type FormFieldLabelProps = {
    label: string;
    optional?: boolean;
};

export function FormFieldLabel({label, optional}: FormFieldLabelProps) {
    if (!label.trim()) {
        return null;
    }
    if (optional) {
        return (
            <>
                {label}
                <span className='light'>
                    {' '}
                    <FormattedMessage
                        id='interactive_dialog.element.optional'
                        defaultMessage='(optional)'
                    />
                </span>
            </>
        );
    }
    return (
        <>
            {label}
            <span className='error-text'>{' *'}</span>
        </>
    );
}
