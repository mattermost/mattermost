// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    inputId?: string;
    label: React.ReactNode;
    labelClassName?: string;
    inputClassName?: string;
    children: React.ReactNode;
    helpText?: React.ReactNode;
    footer?: React.ReactNode;

    /** The row's parts render under it (`${testIdScope}.label--text`, `.help--text`); without it the row keeps its input-id based ids. */
    testIdScope?: string;

    /** The row's own testid when it isn't the scope (a keyed row: `admin.setting:<key>`). */
    testId?: string;
};

const Setting: React.FC<Props> = ({
    inputId,
    label,
    labelClassName,
    inputClassName,
    children,
    footer,
    helpText,
    testIdScope,
    testId,
}: Props) => {
    return (
        <div
            data-testid={testIdScope ? testId ?? testIdScope : inputId}
            className='form-group'
        >
            {label && (
                <label
                    data-testid={testIdScope ? `${testIdScope}.label--text` : inputId + 'label'}
                    className={'control-label ' + labelClassName}
                    htmlFor={inputId}
                >
                    {label}
                </label>
            )}
            <div className={inputClassName}>
                {children}
                <div
                    data-testid={testIdScope ? `${testIdScope}.help--text` : inputId + 'help-text'}
                    className='help-text'
                >
                    {helpText}
                </div>
                {footer}
            </div>
        </div>
    );
};

export default Setting;
