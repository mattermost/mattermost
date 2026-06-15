// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';

export type ButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonVariant = '' | 'destructive' | 'inverted';

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

export interface ButtonStyles {
    emphasis?: ButtonEmphasis;
    size?: ButtonSize;
    variant?: ButtonVariant;
}

export function buttonClassNames({emphasis = 'primary', size = 'md', variant = ''}: ButtonStyles, ...other: classNames.ArgumentArray) {
    let emphasisClass = emphasisClasses[emphasis];
    const sizeClass = sizeClasses[size];
    const variantClass = variantClasses[variant];

    if (emphasis === 'primary' && variant === 'destructive') {
        // TODO in the current CSS, btn-primary overrides btn-danger
        emphasisClass = '';
    }

    return classNames('btn', emphasisClass, sizeClass, variantClass, other);
}
