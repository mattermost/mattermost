// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo, useMemo, useCallback} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import WithTooltip from 'components/with_tooltip';

import './icon_button.scss';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

// Map IconButton sizes to icon pixel sizes (from Figma) - static, so moved outside component
const ICON_SIZE_MAP = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32,
} as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {

    /** Icon size and overall button dimensions */
    size?: IconButtonSize;

    /** Internal padding variation */
    padding?: 'default' | 'compact';

    /** Toggle state for buttons that can be toggled on/off */
    toggled?: boolean;

    /** Destructive action styling (error/danger color scheme) */
    destructive?: boolean;

    /** Visual style variant - inverted for dark backgrounds */
    inverted?: boolean;

    /** Border radius style */
    rounded?: boolean;

    /** Show count/number alongside icon */
    count?: boolean;

    /** Text content for the count (typically used for counts/numbers) - will be truncated to 4 characters if longer */
    countText?: string | number;

    /** Show unread indicator (notification dot) */
    unread?: boolean;

    /** Compass Icon component to display */
    icon: ReactNode;

    /** Accessible label for screen readers */
    'aria-label': string;

    /** Tooltip text (required for accessibility) */
    title: string;

    /** Click handler */
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

    /** Disabled state */
    disabled?: boolean;

    /** Loading state - shows spinner and disables interaction */
    loading?: boolean;

    /** Additional CSS classes */
    className?: string;

    /** Button type */
    type?: 'button' | 'submit' | 'reset';
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({
        size = 'md',
        padding = 'default',
        toggled = false,
        destructive = false,
        inverted = false,
        rounded = false,
        count = false,
        countText,
        unread = false,
        icon,
        disabled = false,
        loading = false,
        className,
        'aria-label': ariaLabel,
        title,
        type = 'button',
        ...htmlProps
    }, ref) => {
        const isDisabled = disabled || loading;

        // Validate and format count text - memoized to prevent recreation on every render
        const validateCountText = useCallback((text: string | number | undefined): string => {
            if (!text) {
                return '';
            }

            const str = String(text).trim();
            const maxLength = 4;

            if (str.length > maxLength) {
                // eslint-disable-next-line no-process-env
                if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.warn(`IconButton: countText "${str}" truncated to "${str.slice(0, maxLength)}"`);
                }
                return str.slice(0, maxLength);
            }

            return str;
        }, []); // No dependencies since this function is pure

        const buttonClasses = useMemo(() => classNames(
            'IconButton',
            `IconButton--${size}`,
            {
                'IconButton--toggled': toggled,
                'IconButton--destructive': destructive,
                'IconButton--inverted': inverted,
                'IconButton--rounded': rounded,
                'IconButton--compact': padding === 'compact',
                'IconButton--loading': loading,
                'IconButton--with-count': count,
                'IconButton--with-unread': unread,
            },
            className,
        ), [size, toggled, destructive, inverted, rounded, padding, loading, count, unread, className]);

        // Clone the icon element and add the appropriate size prop for Compass Icons
        const iconWithSize = useMemo(() => {
            return React.isValidElement(icon) ? React.cloneElement(icon, {size: ICON_SIZE_MAP[size]}) : icon;
        }, [icon, size]);

        return (
            <WithTooltip title={title}>
                <button
                    ref={ref}
                    type={type}
                    className={buttonClasses}
                    disabled={isDisabled}
                    aria-label={ariaLabel}
                    aria-pressed={toggled}
                    {...htmlProps}
                >
                    <span className='IconButton__content'>
                        {loading ? (
                            <span
                                className={classNames(
                                    'IconButton__spinner',
                                    `IconButton__spinner--${size}`,
                                    {
                                        'IconButton__spinner--inverted': inverted,
                                    },
                                )}
                            />
                        ) : (
                            <span className={`IconButton__icon IconButton__icon--${size}`}>
                                {iconWithSize}
                                {unread && (
                                    <span
                                        className={classNames(
                                            'IconButton__unread-indicator',
                                            `IconButton__unread-indicator--${size}`,
                                        )}
                                    />
                                )}
                            </span>
                        )}

                        {count && !loading && (
                            <span className={`IconButton__count IconButton__count--${size}`}>
                                {validateCountText(countText)}
                            </span>
                        )}
                    </span>
                </button>
            </WithTooltip>
        );
    },
);

IconButton.displayName = 'IconButton';

export default memo(IconButton);
