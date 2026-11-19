// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    inputId?: string;
    label: React.ReactNode;
    labelClassName?: string;
    inputClassName?: string;
    children: React.ReactNode;
    subControl?: React.ReactNode;
    helpText?: React.ReactNode;
    footer?: React.ReactNode;
};

const Setting: React.FC<Props> = ({
    inputId,
    label,
    labelClassName,
    inputClassName,
    children,
    subControl,
    footer,
    helpText,
}: Props) => {
    return (
        <div
            data-testid={inputId}
            className='form-group'
        >
            {label && (
                <label
                    data-testid={inputId + 'label'}
                    className={'control-label ' + labelClassName}
                    htmlFor={inputId}
                >
                    {label}
                </label>
            )}
            <div className={inputClassName}>
                {children}
                {subControl}
                <div
                    data-testid={inputId + 'help-text'}
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
