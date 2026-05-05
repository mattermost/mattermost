// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

export type ButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonVariant = '' | 'destructive' | 'inverted';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;

    /**
     * The emphasis level of the button. Controls the colors of the button.
     *
     * Defaults to "primary".
     */
    emphasis?: ButtonEmphasis;

    /**
     * The size of the button as defined in our Compass Design System. Controls the height and font size of the button.
     *
     * Defaults to "md".
     */
    size?: ButtonSize;

    /**
     * The variant of the button. Modifies the color defined by the emphasis level.
     *
     * Defaults to "".
     */
    variant?: ButtonVariant;
}

const emphasisClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    tertiary: 'btn-tertiary',
    quaternary: 'btn-quaternary',
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
            className={classNames('btn', emphasisClass, sizeClass, variantClass, className)}
            {...otherProps}
        >
            {children}
        </button>
    );
});
Button.displayName = 'Button';
