// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

export type ButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'quaternary'/* | 'link'*/;
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonVariant = '' | 'destructive' | 'inverted';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;

    emphasis?: ButtonEmphasis;
    size?: ButtonSize;
    variant?: ButtonVariant;

    // width?: 'full' | number; // TODO
}

const emphasisClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    tertiary: 'btn-tertiary',
    quaternary: 'btn-quaternary',

    // link: 'btn-link',
};
const sizeClasses = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
};
const variantClasses = {
    '': '',
    destructive: 'btn-danger',
    inverted: 'btn-inverted',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
    children,
    className,
    emphasis = 'primary',
    size = 'md',
    variant = '',

    // width = 'auto',

    ...otherProps
}, ref) => {
    let emphasisClass = emphasisClasses[emphasis];
    const sizeClass = sizeClasses[size];
    const variantClass = variantClasses[variant];

    if (emphasis === 'primary' && variant === 'destructive') {
        // TODO in the current CSS, btn-primary overrides btn-danger
        emphasisClass = '';
    }

    return (
        <button
            ref={ref}
            className={classNames('btn', emphasisClass, sizeClass, variantClass, /*{
                // 'btn-full': width === 'full',
            },*/ className)}
            {...otherProps}
        >
            {children}
        </button>
    );
});
Button.displayName = 'Button';
