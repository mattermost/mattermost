// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode} from 'react';

import WithTooltip from 'components/with_tooltip';

import './alert_tag.scss';

export type AlertTagProps = {

    text: string;

    className?: string;

    onClick?: (e: React.MouseEvent) => void;

    variant?: 'default' | 'primary' | 'secondary' | 'info';

    size?: 'small' | 'medium' | 'large';

    testId?: string;

    tooltipTitle?: string | ReactNode;
};

/**
 * A tag component used for displaying alert information
 * Optionally includes tooltip functionality when tooltipTitle is provided
 */
const AlertTag: React.FC<AlertTagProps> = ({
    text,
    className,
    onClick,
    variant = 'default',
    size = 'medium',
    testId,
    tooltipTitle,
}) => {
    // Determine which element to use based on whether onClick is provided
    const TagElement = onClick ? 'button' : 'span';

    const tagElement = (
        <TagElement
            className={classNames(
                'AlertTag',
                `AlertTag--${variant}`,
                `AlertTag--${size}`,
                {
                    'AlertTag--clickable': Boolean(onClick),
                },
                className,
            )}
            onClick={onClick}
            data-testid={testId}

            // Add type="button" to prevent form submission if used within a form
            {...(onClick && {type: 'button'})}
        >
            {text}
        </TagElement>
    );

    // If tooltipTitle is provided, wrap the tag with WithTooltip
    if (tooltipTitle) {
        return (
            <WithTooltip
                title={tooltipTitle}
            >
                {tagElement}
            </WithTooltip>
        );
    }

    // Otherwise, just return the tag
    return tagElement;
};

export default AlertTag;
