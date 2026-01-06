// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo, useMemo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

// Re-enable when WithTooltip is available in platform design system
// import WithTooltip from 'components/with_tooltip';

import Spinner from '../spinner';

import './icon_button.scss';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

// Map IconButton sizes to icon pixel sizes (from Figma) - static, so moved outside component
const ICON_SIZE_MAP = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32,
} as const;

// Map IconButton sizes to Spinner pixel sizes (using Figma design system values)
const ICONBUTTON_SPINNER_SIZE_MAP = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
} as const;

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {

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
    showCount?: boolean;

    /** The count to display */
    count?: number;

    /** Show unread indicator (notification dot) */
    unread?: boolean;

    /** Compass Icon component to display */
    icon: ReactNode;

    /** Loading state - shows spinner and disables interaction */
    loading?: boolean;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({
        size = 'md',
        padding = 'default',
        toggled = false,
        destructive = false,
        inverted = false,
        rounded = false,
        showCount = false,
        count,
        unread = false,
        icon,
        disabled = false,
        loading = false,
        className,
        title,
        ...htmlProps
    }, ref) => {
        const isDisabled = disabled || loading;

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
                'IconButton--with-count': showCount,
                'IconButton--with-unread': unread,
            },
            className,
        ), [size, toggled, destructive, inverted, rounded, padding, loading, showCount, unread, className]);

        // Clone the icon element and add the appropriate size prop for Compass Icons
        const iconWithSize = useMemo(() => {
            return React.isValidElement(icon) ? React.cloneElement(icon, {size: ICON_SIZE_MAP[size]} as Record<string, unknown>) : icon;
        }, [icon, size]);

        return (

            // Re-enable WithTooltip when available in platform design system
            // <WithTooltip title={title}>
            <button
                ref={ref}
                className={buttonClasses}
                disabled={isDisabled}
                aria-pressed={toggled}
                title={title} // Temporary: using native title until WithTooltip is available
                {...htmlProps}
            >
                <span className='IconButton__content'>
                    {loading ? (
                        <Spinner
                            size={ICONBUTTON_SPINNER_SIZE_MAP[size]}
                            inverted={inverted}
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

                    {showCount && !loading && (
                        <span className={`IconButton__count IconButton__count--${size}`}>
                            {count}
                        </span>
                    )}
                </span>
            </button>

        // </WithTooltip>
        );
    },
);

IconButton.displayName = 'IconButton';

const MemoIconButton = memo(IconButton);
MemoIconButton.displayName = 'IconButton';

export default MemoIconButton;
