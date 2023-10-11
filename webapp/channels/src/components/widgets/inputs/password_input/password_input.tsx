// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import type {ChangeEventHandler, FocusEventHandler} from 'react';
import {useIntl} from 'react-intl';

import {ItemStatus} from 'utils/constants';

import Input from '../input/input';
import type {CustomMessageInputType, SIZE} from '../input/input';

import './password_input.scss';

type PasswordInputProps = {
    className?: string;
    value: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onFocus?: FocusEventHandler<HTMLInputElement>;
    hasError?: boolean;
    info?: string;
    error?: string;
    createMode?: boolean;
    disabled?: boolean;
    inputSize?: SIZE;
};

const PasswordInput = React.forwardRef((
    {
        className,
        value,
        onChange,
        onBlur,
        onFocus,
        hasError,
        info,
        error,
        createMode,
        disabled,
        inputSize,
    }: PasswordInputProps,
    ref?: React.Ref<HTMLInputElement>,
) => {
    const {formatMessage} = useIntl();

    const [showPassword, setShowPassword] = useState(false);

    const toggleShowPassword = () => setShowPassword(!showPassword);

    const customMessageError: CustomMessageInputType | null = error ? {type: ItemStatus.ERROR, value: error} : null;
    const customMessageInfo: CustomMessageInputType | null = info ? {type: ItemStatus.INFO, value: info} : null;
    const customMessage = error ? customMessageError : customMessageInfo;

    const placeHolder = createMode ? formatMessage({id: 'widget.passwordInput.createPassword', defaultMessage: 'Choose a Password'}) : formatMessage({id: 'widget.passwordInput.password', defaultMessage: 'Password'});

    return (
        <Input
            className={classNames('password-input', className)}
            wrapperClassName={'password-input-with-toggle'}
            name='password-input'
            type={showPassword && !disabled ? 'text' : 'password'}
            inputSize={inputSize}
            addon={
                <button
                    id='password_toggle'
                    type='button'
                    aria-label={formatMessage({id: 'widget.passwordInput.passwordToggle', defaultMessage: 'Show or hide password'})}
                    className='password-input-toggle'
                    onClick={toggleShowPassword}
                    disabled={disabled}
                >
                    <i className={showPassword && !disabled ? 'icon-eye-off-outline' : 'icon-eye-outline'}/>
                </button>
            }
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder={placeHolder}
            hasError={hasError}
            customMessage={error || info ? customMessage : undefined}
            disabled={disabled}
            ref={ref}
        />
    );
});

export default PasswordInput;
