// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import Input from 'components/widgets/inputs/input/input';

import type {PropertyValueEditorProps} from './types';

function toDisplayString(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    return String(value);
}

export default function TextEditor({field, value, onChange}: PropertyValueEditorProps) {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    const placeholder = formatMessage(
        {id: 'property_value_editor.text.placeholder', defaultMessage: 'Set {name}'},
        {name: field.name},
    );

    return (
        <Input
            type='text'
            useLegend={false}
            data-property-field-id={field.id}
            value={toDisplayString(value)}
            placeholder={placeholder}
            aria-label={field.name}
            onChange={handleChange}
        />
    );
}
