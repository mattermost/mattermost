// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {HTMLAttributes} from 'react';

import './spinner.scss';

// Figma design system spinner sizes
export type SpinnerSize = 10 | 12 | 16 | 20 | 24 | 28 | 32;

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'role'> {

    /** Size of the spinner in pixels (10, 12, 16, 20, 24, 28, 32) */
    size?: SpinnerSize;

    /** Whether the spinner should use inverted colors for dark backgrounds */
    inverted?: boolean;

    /** Accessible label for screen readers */
    'aria-label'?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
    size = 16,
    inverted = false,
    className,
    'aria-label': ariaLabel = 'Loading',
    style,
    ...htmlProps
}) => {
    // Calculate stroke width based on size (roughly 10% of size, with min/max bounds)
    const strokeWidth = Math.max(1, Math.min(3, Math.round(size * 0.1)));

    const spinnerClasses = classNames(
        'Spinner',
        {
            'Spinner--inverted': inverted,
        },
        className,
    );

    const spinnerStyle = {
        width: `${size}px`,
        height: `${size}px`,
        '--spinner-stroke-width': `${strokeWidth}px`,
        ...style,
    };

    return (
        <span
            className={spinnerClasses}
            role='status'
            aria-label={ariaLabel}
            style={spinnerStyle}
            {...htmlProps}
        />
    );
};

Spinner.displayName = 'Spinner';

export default Spinner;
