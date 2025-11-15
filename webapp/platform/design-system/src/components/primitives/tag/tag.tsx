// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo, useMemo} from 'react';
import type {ReactNode, MouseEventHandler} from 'react';

import './tag.scss';

export type TagSize = 'xs' | 'sm' | 'md' | 'lg';

export type TagVariant =
    | 'default'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'dangerDim'
    | 'primary'
    | 'secondary';

export interface TagProps {

    /** The text content of the tag */
    text?: ReactNode;

    /** Size variant of the tag */
    size?: TagSize;

    /** Visual variant/color scheme of the tag */
    variant?: TagVariant;

    /** Whether to display text in uppercase */
    uppercase?: boolean;

    /** Icon element to display before the text (React component with size specified) */
    icon?: ReactNode;

    /** Click handler for interactive tags */
    onClick?: MouseEventHandler<HTMLElement>;

    /** Additional CSS class names */
    className?: string;

    /** Test ID for testing purposes */
    testId?: string;

    /** Full width variant */
    fullWidth?: boolean;
}

/**
 * A unified Tag component for displaying labels, badges, and status indicators in Mattermost.
 *
 * This component provides a flexible API for creating various tag types including
 * preset tags (Beta, Bot, Guest) and custom tags with icons and variants
 *
 * Features:
 * - Multiple size variants (xs, sm, md, lg)
 * - Multiple color/semantic variants (default, info, success, warning, danger, etc.)
 * - Icon support (consumer specifies icon size)
 * - Preset configurations for common tags (beta, bot, guest)
 * - Uppercase text transformation
 * - Click handling for interactive tags
 * - Full accessibility support
 *
 * @example
 * // Basic usage
 * <Tag text="Custom" variant="info" size="sm" />
 *
 * @example
 * // With icon (consumer specifies size)
 * <Tag text="Status" icon={<CheckIcon size={16} />} variant="success" size="sm" />
 *
 * @example
 * // Interactive tag
 * <Tag text="Click me" onClick={() => console.log('clicked')} />
 */
const Tag = forwardRef<HTMLButtonElement | HTMLDivElement, TagProps>(
    (
        {
            text,
            size = 'xs',
            variant = 'default',
            uppercase = false,
            icon,
            onClick,
            className,
            testId,
            fullWidth = false,
            ...rest
        },
        ref,
    ) => {
        // Determine the appropriate HTML element based on interactivity
        const Element = onClick ? 'button' : 'div';

        // Build CSS classes
        const tagClasses = useMemo(() => classNames(
            'Tag',
            `Tag--${size}`,
            `Tag--${variant}`,
            {
                'Tag--uppercase': uppercase,
                'Tag--full-width': fullWidth,
            },
            className,
        ), [size, variant, uppercase, fullWidth, className]);

        // Handle icon - consumer provides fully configured icon component
        const iconElement = useMemo(() => {
            return icon || null;
        }, [icon]);

        // Build the tag element
        const tagElement = (
            <Element
                ref={ref as React.Ref<HTMLButtonElement & HTMLDivElement>}
                className={tagClasses}
                onClick={onClick}
                data-testid={testId}
                aria-label={typeof text === 'string' ? text : undefined}
                {...(onClick && Element === 'button' && {type: 'button'})}
                {...rest}
            >
                {iconElement && (
                    <span className='Tag__icon' aria-hidden='true'>
                        {iconElement}
                    </span>
                )}
                <span className='Tag__text'>
                    {text}
                </span>
            </Element>
        );

        return tagElement;
    },
);

Tag.displayName = 'Tag';

const MemoTag = memo(Tag);
MemoTag.displayName = 'Tag';

export default MemoTag;

