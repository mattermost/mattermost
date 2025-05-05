// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './generic_tag.scss';

export type GenericTagProps = {

    /**
     * The text content of the tag
     */
    text: string;

    /**
     * Optional CSS class name for custom styling
     */
    className?: string;

    /**
     * Optional click handler
     */
    onClick?: (e: React.MouseEvent) => void;

    /**
     * Optional variant for different visual styles
     */
    variant?: 'default' | 'primary' | 'secondary' | 'info';

    /**
     * Optional size
     */
    size?: 'small' | 'medium' | 'large';

    /**
     * Optional test ID for automated testing
     */
    testId?: string;
};

/**
 * A generic tag component that can be used to display labeled information
 */
const GenericTag: React.FC<GenericTagProps> = ({
    text,
    className,
    onClick,
    variant = 'default',
    size = 'medium',
    testId,
}) => {
    return (
        <span
            className={classNames(
                'GenericTag',
                `GenericTag--${variant}`,
                `GenericTag--${size}`,
                {
                    'GenericTag--clickable': Boolean(onClick),
                },
                className,
            )}
            onClick={onClick}
            data-testid={testId}
        >
            {text}
        </span>
    );
};

export default GenericTag;
