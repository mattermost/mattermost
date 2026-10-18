// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ChangeEventHandler, FocusEventHandler, ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import type {FieldMessageTone} from '@mattermost/compass-ui/components/field-message';
import {PasswordInput as CompassPasswordInput} from '@mattermost/compass-ui/components/password-input';
import type {PasswordInputSize} from '@mattermost/compass-ui/components/password-input';

import {ItemStatus} from 'utils/constants';
import {formatAsString} from 'utils/i18n';

import {SIZE} from '../input/input';

type PasswordInputProps = {
    className?: string;
    value: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onFocus?: FocusEventHandler<HTMLInputElement>;
    hasError?: boolean;
    info?: ReactNode;
    error?: ReactNode;
    createMode?: boolean;
    disabled?: boolean;
    inputSize?: SIZE;
    id?: string;
    name?: string;
    label?: string | MessageDescriptor;
    autoFocus?: boolean;
};

const INPUT_SIZE_MAP: Record<SIZE, PasswordInputSize> = {
    [SIZE.MEDIUM]: 'medium',
    [SIZE.LARGE]: 'large',
};

/**
 * @deprecated Prefer `@mattermost/compass-ui/components/password-input` for new UI.
 * Thin host wrapper that maps legacy `error` / `info` / `hasError` onto Compass.
 */
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
        inputSize = SIZE.MEDIUM,
        id,
        name = 'password-input',
        label: labelProp,
        autoFocus,
        ...otherProps
    }: PasswordInputProps,
    ref?: React.Ref<HTMLInputElement>,
) => {
    const {formatMessage} = useIntl();

    const message = error || info;
    let messageTone: FieldMessageTone | undefined;
    if (error) {
        messageTone = ItemStatus.ERROR as FieldMessageTone;
    } else if (info) {
        messageTone = ItemStatus.INFO as FieldMessageTone;
    }

    const defaultLabel = createMode ?
        formatMessage({id: 'widget.passwordInput.createPassword', defaultMessage: 'Choose a Password'}) :
        formatMessage({id: 'widget.passwordInput.password', defaultMessage: 'Password'});
    const label = labelProp ? formatAsString(formatMessage, labelProp) : defaultLabel;

    return (
        <CompassPasswordInput
            ref={ref}
            id={id}
            className={classNames('password-input', className)}
            name={name}
            size={INPUT_SIZE_MAP[inputSize]}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            label={label}
            invalid={Boolean(hasError) || Boolean(error)}
            message={message}
            messageTone={message ? messageTone : undefined}
            disabled={disabled}
            autoFocus={autoFocus}
            showPasswordLabel={formatMessage({
                id: 'widget.passwordInput.showPassword',
                defaultMessage: 'Show password',
            })}
            hidePasswordLabel={formatMessage({
                id: 'widget.passwordInput.hidePassword',
                defaultMessage: 'Hide password',
            })}
            revealButtonProps={{id: `${name}_toggle`}}
            {...otherProps}
        />
    );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
