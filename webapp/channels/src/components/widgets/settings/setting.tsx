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

    /** The row's parts render under it (`${testIdScope}.label--text`, `.help--text`); without it the row renders no test ids. */
    testIdScope?: string;

    /** The row's key: with it the row's own element is `<testIdScope>:<testKey>--group`. */
    testKey?: string;
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
    testKey,
}: Props) => {
    let rootTestId;
    if (testIdScope) {
        rootTestId = testKey ? `${testIdScope}:${testKey}--group` : `${testIdScope}--group`;
    }

    return (
        <div
            role='group'
            data-testid={rootTestId}
            className='form-group'
        >
            {label && (
                <label
                    data-testid={testIdScope ? `${testIdScope}.label--text` : undefined}
                    className={'control-label ' + labelClassName}
                    htmlFor={inputId}
                >
                    {label}
                </label>
            )}
            <div className={inputClassName}>
                {children}
                <div
                    data-testid={testIdScope ? `${testIdScope}.help--text` : undefined}
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
