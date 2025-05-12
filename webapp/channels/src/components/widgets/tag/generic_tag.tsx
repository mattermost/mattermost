// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode} from 'react';

import WithTooltip from 'components/with_tooltip';

import './generic_tag.scss';

export type GenericTagProps = {

    text: string;

    className?: string;

    onClick?: (e: React.MouseEvent) => void;

    variant?: 'default' | 'primary' | 'secondary' | 'info';

    size?: 'small' | 'medium' | 'large';

    testId?: string;

    tooltipTitle?: string | ReactNode;
};

/**
 * A generic tag component that can be used to display labeled information
 * Optionally includes tooltip functionality when tooltipTitle is provided
 */
const GenericTag: React.FC<GenericTagProps> = ({
    text,
    className,
    onClick,
    variant = 'default',
    size = 'medium',
    testId,
    tooltipTitle,
}) => {
    const tagElement = (
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

export default GenericTag;
