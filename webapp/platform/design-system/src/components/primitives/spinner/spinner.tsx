// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {HTMLAttributes} from 'react';

import './spinner.scss';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'role'> {
    /** Size of the spinner */
    size?: SpinnerSize;
    
    /** Whether the spinner should use inverted colors for dark backgrounds */
    inverted?: boolean;
    
    /** Whether this spinner is being used in an IconButton (affects sizing) */
    forIconButton?: boolean;
    
    /** Accessible label for screen readers */
    'aria-label'?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
    size = 'md',
    inverted = false,
    forIconButton = false,
    className,
    'aria-label': ariaLabel = 'Loading',
    ...htmlProps
}) => {
    // Create size modifier that accounts for IconButton differences
    const sizeModifier = forIconButton && (size === 'sm' || size === 'md' || size === 'lg') 
        ? `${size}-icon` 
        : size;

    const spinnerClasses = classNames(
        'Spinner',
        `Spinner--${sizeModifier}`,
        {
            'Spinner--inverted': inverted,
        },
        className,
    );

    return (
        <span
            className={spinnerClasses}
            role="status"
            aria-label={ariaLabel}
            aria-hidden="true"
            {...htmlProps}
        />
    );
};

Spinner.displayName = 'Spinner';

export default Spinner;
