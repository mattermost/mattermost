// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo, useMemo} from 'react';
import type {ReactNode, MouseEventHandler} from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from '../with_tooltip';

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

export type TagPreset = 'beta' | 'bot' | 'guest' | 'custom';

export interface TagProps {

    /** The text content of the tag */
    text?: ReactNode;

    /** Predefined tag type (beta, bot, guest, or custom for manual text) */
    preset?: TagPreset;

    /** Size variant of the tag */
    size?: TagSize;

    /** Visual variant/color scheme of the tag */
    variant?: TagVariant;

    /** Whether to display text in uppercase */
    uppercase?: boolean;

    /** Icon element to display before the text (React component) */
    icon?: ReactNode;

    /** Icon size in pixels - will be auto-calculated based on tag size if not provided */
    iconSize?: number;

    /** Click handler for interactive tags */
    onClick?: MouseEventHandler<HTMLElement>;

    /** Additional CSS class names */
    className?: string;

    /** Test ID for testing purposes */
    testId?: string;

    /** Tooltip content to display on hover */
    tooltip?: ReactNode;

    /** Tooltip content (alternative prop name) */
    tooltipTitle?: ReactNode;

    /** Whether to hide the tag (useful for conditional rendering like guest tags) */
    hide?: boolean;

    /** Full width variant */
    fullWidth?: boolean;
}

/**
 * A unified Tag component for displaying labels, badges, and status indicators in Mattermost.
 *
 * This component provides a flexible API for creating various tag types including
 * preset tags (Beta, Bot, Guest) and custom tags with icons, tooltips, and variants
 *
 * Features:
 * - Multiple size variants (xs, sm, md, lg)
 * - Multiple color/semantic variants (default, info, success, warning, danger, etc.)
 * - Icon support with auto-sizing
 * - Optional tooltip support
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
 * // Preset tag
 * <Tag preset="beta" size="md" />
 *
 * @example
 * // With icon
 * <Tag text="Status" icon={<CheckIcon />} variant="success" />
 *
 * @example
 * // With tooltip
 * <Tag
 *   text="Info"
 *   variant="info"
 *   tooltip="Additional information"
 * />
 *
 * @example
 * // Interactive tag
 * <Tag text="Click me" onClick={() => console.log('clicked')} />
 */
const Tag = forwardRef<HTMLButtonElement | HTMLDivElement, TagProps>(
    (
        {
            text,
            preset = 'custom',
            size = 'xs',
            variant = 'default',
            uppercase = false,
            icon,
            iconSize: customIconSize,
            onClick,
            className,
            testId,
            tooltip,
            tooltipTitle,
            hide = false,
            fullWidth = false,
            ...rest
        },
        ref,
    ) => {
        // i18n support for preset tags
        const {formatMessage} = useIntl();

        // Don't render if hide is true (useful for conditional tags like guest)
        if (hide) {
            return null;
        }

        // Use size directly
        const normalizedSize = size;

        // Determine the appropriate HTML element based on interactivity
        const Element = onClick ? 'button' : 'div';

        // Get preset configuration with i18n support
        const presetConfig = useMemo(() => {
            switch (preset) {
            case 'beta':
                return {
                    text: formatMessage({
                        id: 'tag.default.beta',
                        defaultMessage: 'BETA',
                    }),
                    uppercase: true,
                    variant: variant === 'default' ? 'info' : variant,
                };
            case 'bot':
                return {
                    text: formatMessage({
                        id: 'tag.default.bot',
                        defaultMessage: 'BOT',
                    }),
                    uppercase: true,
                };
            case 'guest':
                return {
                    text: formatMessage({
                        id: 'tag.default.guest',
                        defaultMessage: 'GUEST',
                    }),
                    uppercase: false,
                };
            case 'custom':
            default:
                return null;
            }
        }, [preset, variant, formatMessage]);

        // Use preset text and config if available
        const finalText = presetConfig?.text || text;
        const finalUppercase = presetConfig?.uppercase ?? uppercase;
        const finalVariant = presetConfig?.variant || variant;

        // Calculate icon size based on tag size (using normalized size)
        const iconSize = useMemo(() => {
            if (customIconSize) {
                return customIconSize;
            }
            switch (normalizedSize) {
            case 'lg':
                return 16;
            case 'md':
                return 14;
            case 'sm':
                return 12;
            case 'xs':
            default:
                return 10;
            }
        }, [normalizedSize, customIconSize]);

        // Build CSS classes (using normalized size)
        const tagClasses = useMemo(() => classNames(
            'Tag',
            `Tag--${normalizedSize}`,
            `Tag--${finalVariant}`,
            {
                'Tag--uppercase': finalUppercase,
                'Tag--clickable': Boolean(onClick),
                'Tag--full-width': fullWidth,
            },
            className,
        ), [normalizedSize, finalVariant, finalUppercase, onClick, fullWidth, className]);

        // Handle icon - expects React component with size prop
        const iconElement = useMemo(() => {
            if (!icon) {
                return null;
            }

            // Clone React component and inject icon size
            if (React.isValidElement(icon)) {
                return React.cloneElement(icon as React.ReactElement<{size?: number}>, {
                    size: iconSize,
                });
            }

            return icon;
        }, [icon, iconSize]);

        // Build the tag element
        const tagElement = (
            <Element
                ref={ref as React.Ref<HTMLButtonElement & HTMLDivElement>}
                className={tagClasses}
                onClick={onClick}
                data-testid={testId}
                aria-label={typeof finalText === 'string' ? finalText : undefined}
                {...(onClick && Element === 'button' && {type: 'button'})}
                {...rest}
            >
                {iconElement && (
                    <span className='Tag__icon' aria-hidden='true'>
                        {iconElement}
                    </span>
                )}
                <span className='Tag__text'>
                    {finalText}
                </span>
            </Element>
        );

        // Wrap with tooltip if provided
        const tooltipContent = tooltip || tooltipTitle;
        if (tooltipContent) {
            return (
                <WithTooltip title={tooltipContent}>
                    {tagElement}
                </WithTooltip>
            );
        }

        return tagElement;
    },
);

Tag.displayName = 'Tag';

const MemoTag = memo(Tag);
MemoTag.displayName = 'Tag';

export default MemoTag;

