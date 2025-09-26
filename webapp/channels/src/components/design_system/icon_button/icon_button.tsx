// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import WithTooltip from 'components/with_tooltip';

import './icon_button.scss';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

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

        // Map IconButton sizes to icon pixel sizes (from Figma)
        const iconSizeMap = {
            xs: 14,
            sm: 18,
            md: 24,
            lg: 32,
        };

        const buttonClasses = classNames(
            'IconButton',
            `IconButton--${size}`,
            {
                'IconButton--toggled': toggled,
                'IconButton--destructive': destructive,
                'IconButton--inverted': inverted,
                'IconButton--rounded': rounded,
                'IconButton--compact': padding === 'compact',
                'IconButton--loading': loading,
            },
            className,
        );

        // Clone the icon element and add the appropriate size prop for Compass Icons
        const iconWithSize = React.isValidElement(icon) ?
            React.cloneElement(icon, {size: iconSizeMap[size]}) :
            icon;

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
                        </span>
                    )}
                </button>
            </WithTooltip>
        );
    },
);

IconButton.displayName = 'IconButton';

export default memo(IconButton);
