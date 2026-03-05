// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'crypto';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import SetByEnv from './set_by_env';

type Props = {
    id: string;
    label: React.ReactNode;
    placeholder?: string;
    value: string;
    onChange: (id: string, s: string) => void;
    disabled: boolean;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText: React.ReactNode;
    regenerateText?: React.ReactNode;
    regenerateHelpText?: React.ReactNode;
}

const GeneratedSetting = ({
    id,
    label,
    helpText,
    setByEnv,
    placeholder,
    value,
    disabledText: disabledTextFromProps,
    regenerateHelpText: regenerateHelpTextFromProps,
    onChange,
    disabled = false,
    regenerateText = (
        <FormattedMessage
            id='admin.regenerate'
            defaultMessage='Regenerate'
        />
    ),
}: Props) => {
    const regenerate = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        // Pure base64 implementation can contain characters that are not URL safe without additional
        // encoding. Adopt a URL/Filename safer alphabet as noted in https://datatracker.ietf.org/doc/html/rfc4648#section-5
        // where: 62 - (minus) , 63 _ (underscore)
        const value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        onChange(id, value.replaceAll('+', '-').replaceAll('/', '_'));
    }, [id, onChange]);

    let disabledText = null;
    if (disabled && disabledTextFromProps) {
        disabledText = (
            <div className='admin-console__disabled-text'>
                {disabledTextFromProps}
            </div>
        );
    }

    let regenerateHelpText = null;
    if (regenerateHelpTextFromProps) {
        regenerateHelpText = (
            <div className='help-text'>
                {regenerateHelpTextFromProps}
            </div>
        );
    }

    let text: React.ReactNode = value;
    if (!text) {
        text = (
            <span className='placeholder-text'>{placeholder}</span>
        );
    }

    return (
        <div className='form-group'>
            <label
                className='control-label col-sm-4'
                htmlFor={id}
            >
                {label}
            </label>
            <div className='col-sm-8'>
                <div
                    className='form-control disabled'
                    id={id}
                >
                    {text}
                </div>
                {disabledText}
                <div className='help-text'>
                    {helpText}
                </div>
                <div className='help-text'>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={regenerate}
                        disabled={disabled || setByEnv}
                    >
                        {regenerateText}
                    </button>
                </div>
                {regenerateHelpText}
                {setByEnv ? <SetByEnv/> : null}
            </div>
        </div>
    );
};

export default memo(GeneratedSetting);
