// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import './shared.scss';

interface TestButtonProps {
    onClick: () => void;
    disabled: boolean;
}

interface AddAttributeButtonProps {
    onClick: () => void;
    disabled: boolean;
}

export function TestButton({onClick, disabled}: TestButtonProps): JSX.Element {
    return (
        <button
            className='btn btn-sm btn-tertiary'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-lock-outline'/>
            <FormattedMessage
                id='admin.access_control.table_editor.test_access_rule'
                defaultMessage='Test access rule'
            />
        </button>
    );
}

export function AddAttributeButton({onClick, disabled}: AddAttributeButtonProps): JSX.Element {
    return (
        <button
            className='btn btn-sm btn-tertiary'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-plus'/>
            <FormattedMessage
                id='admin.access_control.table_editor.add_attribute'
                defaultMessage='Add attribute'
            />
        </button>
    );
}
