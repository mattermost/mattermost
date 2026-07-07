// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {buttonClassNames, type ButtonEmphasis, type ButtonSize, type ButtonVariant} from './button_classes';

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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
    children,
    className,

    emphasis,
    size,
    variant,

    ...otherProps
}, ref) => {
    return (
        <button
            ref={ref}
            className={buttonClassNames({emphasis, size, variant}, className)}
            {...otherProps}
        >
            {children}
        </button>
    );
});
Button.displayName = 'Button';
