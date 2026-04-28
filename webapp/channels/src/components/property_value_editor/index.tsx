// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import DateEditor from './date_editor';
import TextEditor from './text_editor';
import type {PropertyValueEditorProps} from './types';

export type {PropertyValueEditorProps} from './types';

export default function PropertyValueEditor(props: PropertyValueEditorProps) {
    switch (props.field.type) {
    case 'text':
        return <TextEditor {...props}/>;
    case 'date':
        return <DateEditor {...props}/>;
    default:
        return (
            <span
                className='property-value-editor property-value-editor--unsupported'
                data-property-field-id={props.field.id}
            >
                <FormattedMessage
                    id='property_value_editor.unsupported'
                    defaultMessage='{type} not yet supported'
                    values={{type: props.field.type}}
                />
            </span>
        );
    }
}
